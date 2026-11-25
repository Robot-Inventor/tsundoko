import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

const maxConcurrentOutboundFetches = 8;
const maxConcurrentPerKey = 4;
const maxConcurrentImageFetches = 16;
const maxConcurrentImagePerKey = 8;
const maxConcurrentThumbnailReads = 8;
const maxConcurrentThumbnailReadsPerKey = 4;
// A backstop that recovers points from a task that never settles; it comfortably exceeds every
// task timeout in the app, and normal slots return through reward() the moment a task settles.
// A task that outlives the window temporarily over-credits the pool until the next expiry.
const gateWindowSeconds = 60;

// A concurrency gate on the library's consume/reward pattern: one point per pool is held while the
// task runs and returned when it does. A rejected consume is refunded at once — the library keeps
// the point counted on rejection, so without the refund a burst of busy answers would exhaust the
// window and close the pool for up to its full duration. Admission stays immediate or not at all:
// a late image is worth less than a fast retriable answer, so waiting would only turn successful
// loads into confusing failures.
const createGate = (maxConcurrent: number, maxPerKey: number) => {
    const globalPool = new RateLimiterMemory({ duration: gateWindowSeconds, points: maxConcurrent });
    const perKeyPool = new RateLimiterMemory({ duration: gateWindowSeconds, points: maxPerKey });

    return async <T>(key: string, task: () => Promise<T>): Promise<T> => {
        try {
            await globalPool.consume("process");
        } catch (error) {
            await globalPool.reward("process");

            throw error;
        }

        try {
            await perKeyPool.consume(key);
        } catch (error) {
            await globalPool.reward("process");
            await perKeyPool.reward(key);

            throw error;
        }

        try {
            return await task();
        } finally {
            await globalPool.reward("process");
            await perKeyPool.reward(key);
        }
    };
};

// Saves, previews and embeddings share a small pool. Images get their own pool with room for the
// browser's parallel subresource requests, so loading a bookmark list cannot starve saving. Stored
// thumbnails are read from disk, so they also get a separate small gate to bound buffered bytes.
const runOutbound = createGate(maxConcurrentOutboundFetches, maxConcurrentPerKey);
const runImageOutbound = createGate(maxConcurrentImageFetches, maxConcurrentImagePerKey);
const runThumbnailRead = createGate(maxConcurrentThumbnailReads, maxConcurrentThumbnailReadsPerKey);

export { RateLimiterRes, runImageOutbound, runOutbound, runThumbnailRead };
