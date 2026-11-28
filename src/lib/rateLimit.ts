import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import type { AuthEnv } from "../authMiddleware";
import type { MiddlewareHandler } from "hono";
import { apiError } from "./apiError";
import { createMiddleware } from "hono/factory";
import { httpStatus } from "./httpStatus";

const rateLimitWindowSeconds = 60;
const millisecondsPerSecond = 1000;

type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

// A fixed window per user is enough here: the goal is to bound outbound work, not to smooth bursts
// precisely. A limiter can be shared by routes and MCP tools that spend the same resource.
const createRateLimiter = ({ limit }: { limit: number }) => {
    const limiter = new RateLimiterMemory({ duration: rateLimitWindowSeconds, points: limit });

    return async (key: string): Promise<RateLimitResult> => {
        try {
            await limiter.consume(key);

            return {
                allowed: true
            };
        } catch (error) {
            if (!(error instanceof RateLimiterRes)) {
                throw error;
            }

            return {
                allowed: false,
                retryAfterSeconds: Math.ceil(error.msBeforeNext / millisecondsPerSecond)
            };
        }
    };
};

const rateLimitMiddleware = (consume: (key: string) => Promise<RateLimitResult>): MiddlewareHandler<AuthEnv> =>
    createMiddleware<AuthEnv>(async (context, next) => {
        const result = await consume(context.get("userId"));

        if (!result.allowed) {
            context.header("Cache-Control", "no-store");
            context.header("Retry-After", String(result.retryAfterSeconds));

            return context.json(apiError("rateLimit"), httpStatus.tooManyRequests);
        }

        return next();
    });

export { type RateLimitResult, createRateLimiter, rateLimitMiddleware };
