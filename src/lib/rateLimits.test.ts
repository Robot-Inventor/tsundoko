import { Hono, type MiddlewareHandler } from "hono";
import { bookmarkListLimiter, bookmarkListRateLimit, bookmarkWriteLimiter, bookmarkWriteRateLimit } from "./rateLimits";
import { describe, expect, it } from "vitest";
import type { AuthEnv } from "../authMiddleware";

const tooManyRequests = 429;
const writeLimit = 30;
const readLimit = 60;

const buildApp = (middleware: MiddlewareHandler<AuthEnv>): Hono<AuthEnv> =>
    new Hono<AuthEnv>()
        .use("*", async (context, next) => {
            context.set("userId", context.req.header("x-user") ?? "user-a");

            return next();
        })
        .get("/", middleware, (context) => context.text("ok"));

const exhaust = async (limiter: (key: string) => Promise<unknown>, count: number): Promise<void> => {
    await Promise.all(Array.from({ length: count }, async () => limiter("user-a")));
};

describe("shared rate limiters", () => {
    it("applies the MCP write consumption to the REST middleware", async () => {
        const app = buildApp(bookmarkWriteRateLimit);

        await exhaust(bookmarkWriteLimiter, writeLimit);

        expect((await app.request("/")).status).toBe(tooManyRequests);
    });

    it("applies the MCP read consumption to the REST middleware", async () => {
        const app = buildApp(bookmarkListRateLimit);

        await exhaust(bookmarkListLimiter, readLimit);

        expect((await app.request("/")).status).toBe(tooManyRequests);
    });
});
