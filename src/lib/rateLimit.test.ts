import { createRateLimit, createRateLimiter, rateLimitMiddleware } from "./rateLimit";
import { describe, expect, it } from "vitest";
import type { AuthEnv } from "../authMiddleware";
import { Hono } from "hono";

const requestLimit = 2;
const ok = 200;
const tooManyRequests = 429;

const buildApp = (): Hono<AuthEnv> =>
    new Hono<AuthEnv>()
        .use("*", async (context, next) => {
            context.set("userId", context.req.header("x-user") ?? "user-a");

            return next();
        })
        .use("*", rateLimitMiddleware(createRateLimiter({ limit: requestLimit })))
        .get("/", (context) => context.text("ok"));

const requestAs = async (app: Hono<AuthEnv>, user: string): Promise<Response> =>
    app.request("/", {
        headers: {
            "x-user": user
        }
    });

describe("rate limit middleware", () => {
    it("answers over-limit requests with 429, Retry-After and no-store", async () => {
        const app = buildApp();

        await requestAs(app, "user-a");
        await requestAs(app, "user-a");

        const limited = await requestAs(app, "user-a");

        expect(limited.status).toBe(tooManyRequests);
        expect(limited.headers.get("retry-after")).toBe("60");
        expect(limited.headers.get("cache-control")).toBe("no-store");
    });

    it("uses a supplied key, giving each client its own budget", async () => {
        const app = new Hono<AuthEnv>()
            .use(
                "*",
                createRateLimit({
                    key: (context) => context.req.header("x-forwarded-for") ?? "unknown",
                    limit: requestLimit
                })
            )
            .get("/", (context) => context.text("ok"));

        const requestFrom = (ip: string): Promise<Response> =>
            app.request("/", {
                headers: {
                    "x-forwarded-for": ip
                }
            });

        await requestFrom("203.0.113.1");
        await requestFrom("203.0.113.1");

        expect((await requestFrom("203.0.113.1")).status).toBe(tooManyRequests);
        expect((await requestFrom("203.0.113.2")).status).toBe(ok);
    });
});
