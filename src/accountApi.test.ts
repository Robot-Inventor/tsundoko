import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AuthEnv } from "./authMiddleware";
import { Hono } from "hono";

const payloadTooLarge = 413;
const oversizedValueLength = 20_000;
const oversizedSortBy = "x".repeat(oversizedValueLength);
const tooManyRequests = 429;
const avatarRequestLimit = 10;
const invalidAvatar = Buffer.from("not an image");

const buildApp = async (userId: string): Promise<Hono<AuthEnv>> => {
    vi.resetModules();
    const { accountApi } = await import("./accountApi");
    const app = new Hono<AuthEnv>();

    app.use("*", async (context, next) => {
        context.set("sessionStartedAt", new Date());
        context.set("userId", userId);
        await next();
    });

    app.route("/", accountApi);

    return app;
};

const postInvalidAvatar = (app: Hono<AuthEnv>): Promise<Response> =>
    app.request("/api/me/avatar", {
        body: invalidAvatar,
        headers: {
            "content-type": "image/png"
        },
        method: "POST"
    });

beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-thirty-two-characters";
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/test";

    vi.resetModules();
});

describe("PATCH /api/me", () => {
    it("rejects a body larger than the limit before parsing it", async () => {
        const { accountApi } = await import("./accountApi");
        const response = await accountApi.request("/api/me", {
            body: JSON.stringify({ sortByActive: oversizedSortBy }),
            headers: {
                "content-type": "application/json"
            },
            method: "PATCH"
        });

        expect(response.status).toBe(payloadTooLarge);
        expect(await response.json()).toMatchObject({
            error: {
                code: "auth.tooLong"
            }
        });
    });
});

describe("avatar upload rate limit", () => {
    it("answers requests beyond the limit with 429", async () => {
        const app = await buildApp("avatar-rate-user");

        for (let index = 0; index < avatarRequestLimit; index++) {
            // Requests have to settle one at a time so each consumes one point of the fixed window.
            // oxlint-disable-next-line no-await-in-loop
            await postInvalidAvatar(app);
        }

        const limited = await postInvalidAvatar(app);

        expect(limited.status).toBe(tooManyRequests);
    });
});
