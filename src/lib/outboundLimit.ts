// oxlint-disable no-magic-numbers -- The counters and caps are self-evident constants.
const maxConcurrentOutboundFetches = 8;
const maxConcurrentPerKey = 4;
const maxConcurrentImageFetches = 16;
const maxConcurrentImagePerKey = 8;

class OutboundBusyError extends Error {}

const createGate = (maxConcurrent: number, maxPerKey: number) => {
    const active = new Map<string, number>();

    const countFor = (key: string): number => active.get(key) ?? 0;

    const totalActive = (): number => {
        let total = 0;

        for (const count of active.values()) {
            total += count;
        }

        return total;
    };

    // Admit immediately or not at all. A late image is worth less than a fast retriable answer, so
    // waiting would only turn successful loads into confusing failures.
    const acquire = (key: string): void => {
        if (totalActive() >= maxConcurrent || countFor(key) >= maxPerKey) {
            throw new OutboundBusyError("No outbound request slot is available");
        }

        active.set(key, countFor(key) + 1);
    };

    const release = (key: string): void => {
        const remaining = countFor(key) - 1;

        if (remaining) {
            active.set(key, remaining);
        } else {
            active.delete(key);
        }
    };

    return async <T>(key: string, task: () => Promise<T>): Promise<T> => {
        acquire(key);

        try {
            return await task();
        } finally {
            release(key);
        }
    };
};

// Saves, previews and embeddings share a small pool. Images get their own pool with room for the
// browser's parallel subresource requests, so loading a bookmark list cannot starve saving.
const runOutbound = createGate(maxConcurrentOutboundFetches, maxConcurrentPerKey);
const runImageOutbound = createGate(maxConcurrentImageFetches, maxConcurrentImagePerKey);

export { OutboundBusyError, runImageOutbound, runOutbound };
