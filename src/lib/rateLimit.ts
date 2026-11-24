import type { AuthEnv } from "../authMiddleware";
import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { httpStatus } from "./httpStatus";

const defaultWindowMs = 60_000;
const millisecondsPerSecond = 1000;
const rateLimitMessage = "リクエストが多すぎます。しばらくしてからお試しください。";

interface RateLimitOptions {
    limit: number;
}

interface Window {
    count: number;
    resetAt: number;
}

interface RateLimitResult {
    allowed: boolean;
    retryAfterSeconds: number;
}

// A fixed window per user is enough here: the goal is to bound outbound work, not to smooth bursts
// precisely. Each route that spends server resources gets its own limiter.
const createRateLimiter = ({ limit }: RateLimitOptions) => {
    const windows = new Map<string, Window>();

    return (key: string, now = Date.now()): RateLimitResult => {
        const current = windows.get(key);
        const window =
            !current || now >= current.resetAt
                ? {
                      count: 0,
                      resetAt: now + defaultWindowMs
                  }
                : current;

        if (window.count >= limit) {
            return {
                allowed: false,
                retryAfterSeconds: Math.ceil((window.resetAt - now) / millisecondsPerSecond)
            };
        }

        window.count += 1;
        windows.set(key, window);

        return {
            allowed: true,
            retryAfterSeconds: 0
        };
    };
};

const createRateLimit = (options: RateLimitOptions): MiddlewareHandler<AuthEnv> => {
    const take = createRateLimiter(options);

    return createMiddleware<AuthEnv>(async (context, next) => {
        const result = take(context.get("userId"));

        if (!result.allowed) {
            context.header("Retry-After", String(result.retryAfterSeconds));

            return context.json({ error: rateLimitMessage }, httpStatus.tooManyRequests);
        }

        return next();
    });
};

export { createRateLimit };
