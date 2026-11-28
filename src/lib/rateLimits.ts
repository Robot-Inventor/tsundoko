import { createRateLimiter, rateLimitMiddleware } from "./rateLimit";

// REST and MCP share these budgets: both ultimately spend the same outbound fetches and embeddings.
const bookmarkListLimiter = createRateLimiter({ limit: 60 });
const bookmarkWriteLimiter = createRateLimiter({ limit: 30 });
const tagListLimiter = createRateLimiter({ limit: 60 });
const tagWriteLimiter = createRateLimiter({ limit: 30 });
const mcpTokenLimiter = createRateLimiter({ limit: 120 });

const bookmarkListRateLimit = rateLimitMiddleware(bookmarkListLimiter);
const bookmarkWriteRateLimit = rateLimitMiddleware(bookmarkWriteLimiter);
const tagListRateLimit = rateLimitMiddleware(tagListLimiter);
const tagWriteRateLimit = rateLimitMiddleware(tagWriteLimiter);

export {
    bookmarkListLimiter,
    bookmarkListRateLimit,
    bookmarkWriteLimiter,
    bookmarkWriteRateLimit,
    mcpTokenLimiter,
    tagListLimiter,
    tagListRateLimit,
    tagWriteRateLimit
};
