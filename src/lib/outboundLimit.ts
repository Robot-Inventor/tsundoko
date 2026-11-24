const maxConcurrentOutboundFetches = 8;
const acquireTimeoutMs = 5000;
const slot = 1;
const absentIndex = -1;

interface Waiter {
    resolve: () => void;
}

// Bound how many outbound operations one process runs at once, and how long a request may wait for
// a slot. A full queue fails fast instead of hanging the handler indefinitely. The limit is per
// process; running several replicas multiplies it.
const createSemaphore = (maxConcurrent: number, waitMs: number) => {
    let active = 0;
    const waiting: Waiter[] = [];

    const release = (): void => {
        active -= slot;
        const next = waiting.shift();

        if (next) {
            active += slot;
            next.resolve();
        }
    };

    const acquire = async (): Promise<void> => {
        if (active < maxConcurrent) {
            active += slot;

            return;
        }

        await new Promise<void>((resolve, reject) => {
            const waiter: Waiter = {
                resolve: () => {
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

            waiter.resolve = (): void => {
                clearTimeout(timer);
                resolve();
            };

            waiting.push(waiter);
        });
    };

    return async <T>(task: () => Promise<T>): Promise<T> => {
        await acquire();

        try {
            return await task();
        } finally {
            release();
        }
    };
};

const runOutbound = createSemaphore(maxConcurrentOutboundFetches, acquireTimeoutMs);

export { runOutbound };
