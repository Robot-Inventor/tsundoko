import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthEnv } from "../authMiddleware";
import { Hono } from "hono";
import { createRateLimit } from "./rateLimit";

const requestLimit = 2;
const windowMs = 60_000;
const windowAdvanceMs = 60_001;
const okStatus = 200;
const tooManyRequests = 429;

const buildApp = (): Hono<AuthEnv> =>
    new Hono<AuthEnv>()
        .use("*", async (context, next) => {
            context.set("userId", "user-a");

            return next();
        })
        .use("*", createRateLimit({ limit: requestLimit, windowMs }))
        .get("/", (context) => context.text("ok"));

afterEach(() => {
    vi.useRealTimers();
});

describe("per-user rate limit", () => {
    it("allows requests up to the limit and rejects the next one", async () => {
        const app = buildApp();

        expect((await app.request("/")).status).toBe(okStatus);
        expect((await app.request("/")).status).toBe(okStatus);

        const limited = await app.request("/");

        expect(limited.status).toBe(tooManyRequests);
        expect(limited.headers.get("retry-after")).toBe("60");
    });

    it("opens a fresh window after the configured interval", async () => {
        vi.useFakeTimers();
        const app = buildApp();

        await app.request("/");
        await app.request("/");
        expect((await app.request("/")).status).toBe(tooManyRequests);

        vi.setSystemTime(Date.now() + windowAdvanceMs);

        expect((await app.request("/")).status).toBe(okStatus);
    });
});
