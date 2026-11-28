import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import type { AuthEnv } from "../authMiddleware";
import type { MiddlewareHandler } from "hono";
import { apiError } from "./apiError";
import { createMiddleware } from "hono/factory";
import { httpStatus } from "./httpStatus";

const rateLimitWindowSeconds = 60;
const millisecondsPerSecond = 1000;

// A fixed window per user is enough here: the goal is to bound outbound work, not to smooth bursts
// precisely. A limiter can be shared by routes that spend the same resource.
const createRateLimit = ({ limit }: { limit: number }): MiddlewareHandler<AuthEnv> => {
    const limiter = new RateLimiterMemory({ duration: rateLimitWindowSeconds, points: limit });

    return createMiddleware<AuthEnv>(async (context, next) => {
        try {
            await limiter.consume(context.get("userId"));
        } catch (error) {
            if (!(error instanceof RateLimiterRes)) {
                throw error;
            }

            context.header("Cache-Control", "no-store");
            context.header("Retry-After", String(Math.ceil(error.msBeforeNext / millisecondsPerSecond)));

            return context.json(apiError("rateLimit"), httpStatus.tooManyRequests);
        }

        return next();
    });
};

export { createRateLimit };
