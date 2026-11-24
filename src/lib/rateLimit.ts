import type { AuthEnv } from "../authMiddleware";
import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { httpStatus } from "./httpStatus";

const defaultWindowMs = 60_000;
const millisecondsPerSecond = 1000;

interface RateLimitOptions {
    limit: number;
    windowMs?: number;
}

interface Window {
    count: number;
    resetAt: number;
}

// A fixed window per user is enough here: the goal is to bound outbound work, not to smooth bursts
// precisely. Each route that spends server resources gets its own limiter.
const createRateLimit = ({ limit, windowMs = defaultWindowMs }: RateLimitOptions): MiddlewareHandler<AuthEnv> => {
    const windows = new Map<string, Window>();

    return createMiddleware<AuthEnv>(async (context, next) => {
        const userId = context.get("userId");
        const now = Date.now();
        const current = windows.get(userId);
        const window =
            !current || now >= current.resetAt
                ? {
                      count: 0,
                      resetAt: now + windowMs
                  }
                : current;

        if (window.count >= limit) {
            context.header("Retry-After", String(Math.ceil((window.resetAt - now) / millisecondsPerSecond)));

            return context.json(
                { error: "リクエストが多すぎます。しばらくしてからお試しください。" },
                httpStatus.tooManyRequests
            );
        }

        window.count += 1;
        windows.set(userId, window);

        return next();
    });
};

export { createRateLimit };
