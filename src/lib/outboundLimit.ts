const maxConcurrentOutboundFetches = 8;
const slot = 1;

// Limit how many outbound requests one process makes at once so a burst cannot exhaust sockets or
// memory even when each request is under its per-user rate limit.
const createSemaphore = (maxConcurrent: number) => {
    let active = 0;
    const waiting: Array<() => void> = [];

    const release = (): void => {
        active -= slot;
        const next = waiting.shift();

        if (next) {
            active += slot;
            next();
        }
    };

    return async <T>(task: () => Promise<T>): Promise<T> => {
        if (active >= maxConcurrent) {
            await new Promise<void>((resolve) => {
                waiting.push(resolve);
            });
        } else {
            active += slot;
        }

        try {
            return await task();
        } finally {
            release();
        }
    };
};

const runOutbound = createSemaphore(maxConcurrentOutboundFetches);

export { createSemaphore, runOutbound };
