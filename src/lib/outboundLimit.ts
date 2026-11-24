const maxConcurrentOutboundFetches = 8;
const maxConcurrentPerKey = 4;
const acquireTimeoutMs = 5000;
const slot = 1;
const absentIndex = -1;
const emptyCount = 0;

interface Waiter {
    key: string;
    start: () => void;
}

// Bound how many outbound operations one process runs at once, how many of them one user can hold,
// and how long a request may wait for a slot. A full queue fails fast instead of hanging the
// handler. The limit is per process; running several replicas multiplies it.
const createSemaphore = (maxConcurrent: number, maxPerKey: number, waitMs: number) => {
    let active = 0;
    const activePerKey = new Map<string, number>();
    const waiting: Waiter[] = [];

    const countFor = (key: string): number => activePerKey.get(key) ?? emptyCount;

    const start = (waiter: Waiter): void => {
        active += slot;
        activePerKey.set(waiter.key, countFor(waiter.key) + slot);
        waiter.start();
    };

    const canStart = (key: string): boolean => active < maxConcurrent && countFor(key) < maxPerKey;

    // Waiters are scanned in order, so a user at their own cap does not block requests from others.
    const drain = (): void => {
        for (let index = 0; index < waiting.length;) {
            const waiter = waiting[index];

            if (!waiter) {
                return;
            }

            if (canStart(waiter.key)) {
                waiting.splice(index, slot);
                start(waiter);
            } else {
                index += slot;
            }
        }
    };

    const release = (key: string): void => {
        active -= slot;
        const remaining = countFor(key) - slot;

        if (remaining) {
            activePerKey.set(key, remaining);
        } else {
            activePerKey.delete(key);
        }

        drain();
    };

    const acquire = async (key: string): Promise<void> => {
        if (canStart(key)) {
            active += slot;
            activePerKey.set(key, countFor(key) + slot);

            return;
        }

        await new Promise<void>((resolve, reject) => {
            const waiter: Waiter = {
                key,
                start: () => {
                    // Replaced below once the timer exists.
                }
            };

            const timer = setTimeout(() => {
                const index = waiting.indexOf(waiter);

                if (index !== absentIndex) {
                    waiting.splice(index, slot);
                }

                reject(new Error("Timed out waiting for an outbound request slot"));
            }, waitMs);

            waiter.start = (): void => {
                clearTimeout(timer);
                resolve();
            };

            waiting.push(waiter);
        });
    };

    return async <T>(key: string, task: () => Promise<T>): Promise<T> => {
        await acquire(key);

        try {
            return await task();
        } finally {
            release(key);
        }
    };
};

const runOutbound = createSemaphore(maxConcurrentOutboundFetches, maxConcurrentPerKey, acquireTimeoutMs);

export { runOutbound };
