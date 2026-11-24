// oxlint-disable no-magic-numbers -- The counters are self-evident 0 and 1.
const maxConcurrentOutboundFetches = 8;
const maxConcurrentPerKey = 4;

class OutboundBusyError extends Error {}

const active = new Map<string, number>();

const countFor = (key: string): number => active.get(key) ?? 0;
const totalActive = (): number => {
    let total = 0;

    for (const count of active.values()) {
        total += count;
    }

    return total;
};

// Admit immediately or not at all. Browser subresource loads open several requests at once and a
// late image is worth less than a fast retriable answer, so waiting would only turn successful
// loads into confusing failures.
const acquire = (key: string): void => {
    if (totalActive() >= maxConcurrentOutboundFetches || countFor(key) >= maxConcurrentPerKey) {
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

const runOutbound = async <T>(key: string, task: () => Promise<T>): Promise<T> => {
    acquire(key);

    try {
        return await task();
    } finally {
        release(key);
    }
};

export { OutboundBusyError, runOutbound };
