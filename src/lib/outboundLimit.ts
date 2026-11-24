const maxConcurrentOutboundFetches = 8;
const maxConcurrentPerUser = 1;
const noActiveRequests = 0;
const acquireTimeoutMs = 5000;
const slot = 1;
const absentIndex = -1;

interface Waiter {
    resolve: () => void;
}

// Bound how many outbound requests one process makes at once, and how long a request may wait for
// a slot. A full queue fails fast instead of hanging the handler indefinitely.
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

const activePerUser = new Map<string, number>();

// One user cannot occupy the whole outbound budget. This is a separate, immediate gate: a second
// concurrent request from the same user is rejected rather than queued behind the global limit.
const runOutboundFor = async <T>(userId: string, task: () => Promise<T>): Promise<T> => {
    const active = activePerUser.get(userId) ?? noActiveRequests;

    if (active >= maxConcurrentPerUser) {
        throw new Error("Too many outbound requests for this user");
    }

    activePerUser.set(userId, active + slot);

    try {
        return await runOutbound(task);
    } finally {
        const remaining = (activePerUser.get(userId) ?? slot) - slot;

        if (remaining) {
            activePerUser.set(userId, remaining);
        } else {
            activePerUser.delete(userId);
        }
    }
};

export { runOutbound, runOutboundFor };
