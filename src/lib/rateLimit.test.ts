import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthEnv } from "../authMiddleware";
import { Hono } from "hono";
import { createRateLimit } from "./rateLimit";

const requestLimit = 2;
const windowAdvanceMs = 60_001;
const okStatus = 200;
const tooManyRequests = 429;

const buildApp = (): Hono<AuthEnv> =>
    new Hono<AuthEnv>()
        .use("*", async (context, next) => {
            context.set("userId", context.req.header("x-user") ?? "user-a");

            return next();
        })
        .use("*", createRateLimit({ limit: requestLimit }))
        .get("/", (context) => context.text("ok"));

const requestAs = async (app: Hono<AuthEnv>, user: string): Promise<Response> =>
    app.request("/", {
        headers: {
            "x-user": user
        }
    });

afterEach(() => {
    vi.useRealTimers();
});

describe("per-user rate limit", () => {
    it("allows requests up to the limit and rejects the next one", async () => {
        const app = buildApp();

        expect((await requestAs(app, "user-a")).status).toBe(okStatus);
        expect((await requestAs(app, "user-a")).status).toBe(okStatus);

        const limited = await requestAs(app, "user-a");

        expect(limited.status).toBe(tooManyRequests);
        expect(limited.headers.get("retry-after")).toBe("60");
        expect(limited.headers.get("cache-control")).toBe("no-store");
    });

    it("keeps other users unaffected", async () => {
        const app = buildApp();

        await requestAs(app, "user-a");
        await requestAs(app, "user-a");
        expect((await requestAs(app, "user-a")).status).toBe(tooManyRequests);

        expect((await requestAs(app, "user-b")).status).toBe(okStatus);
    });

    it("opens a fresh window after the configured interval", async () => {
        vi.useFakeTimers();
        const app = buildApp();

        await requestAs(app, "user-a");
        await requestAs(app, "user-a");
        expect((await requestAs(app, "user-a")).status).toBe(tooManyRequests);

        vi.setSystemTime(Date.now() + windowAdvanceMs);

        expect((await requestAs(app, "user-a")).status).toBe(okStatus);
    });
});
