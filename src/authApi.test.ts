import { beforeAll, describe, expect, it, vi } from "vitest";

const payloadTooLarge = 413;
const tooManyRequests = 429;
const oversizedNameLength = 20_000;
const oversizedName = "x".repeat(oversizedNameLength);
// Matches the unauthenticated route budget in authApi.ts.
const authRequestLimit = 30;

beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-thirty-two-characters";
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/test";

    vi.resetModules();
});

describe("signup context endpoint", () => {
    it("rejects a body larger than the limit before parsing it", async () => {
        const { authApi } = await import("./authApi");
        const response = await authApi.request("/api/auth/signup-context", {
            body: JSON.stringify({ email: "a@example.com", name: oversizedName }),
            headers: {
                "content-type": "application/json"
            },
            method: "POST"
        });

        expect(response.status).toBe(payloadTooLarge);
    });
});

describe("unauthenticated auth endpoints", () => {
    it("shares one per-IP budget between status and signup-context", async () => {
        const { authApi } = await import("./authApi");
        const postOversizedSignup = (ip: string): Promise<Response> =>
            authApi.request("/api/auth/signup-context", {
                body: JSON.stringify({ email: "a@example.com", name: oversizedName }),
                headers: {
                    "content-type": "application/json",
                    "x-forwarded-for": ip
                },
                method: "POST"
            });

        const ip = "203.0.113.20";
        const withinBudget = await Promise.all(Array.from({ length: authRequestLimit }, () => postOversizedSignup(ip)));

        expect(withinBudget.every((response) => response.status === payloadTooLarge)).toBe(true);
        expect((await postOversizedSignup(ip)).status).toBe(tooManyRequests);

        // A forged leading entry must not buy a fresh budget; the proxy-supplied last entry still keys the limit.
        expect((await postOversizedSignup(`198.51.100.5, ${ip}`)).status).toBe(tooManyRequests);

        const status = await authApi.request("/api/auth/status", {
            headers: {
                "x-forwarded-for": ip
            }
        });

        expect(status.status).toBe(tooManyRequests);
        expect(status.headers.get("retry-after")).toBe("60");
        expect(status.headers.get("cache-control")).toBe("no-store");
        expect((await postOversizedSignup("203.0.113.21")).status).toBe(payloadTooLarge);
    });
});

describe("auth catch-all endpoint", () => {
    it("rejects a body larger than the limit before forwarding it", async () => {
        const { authApi } = await import("./authApi");
        const response = await authApi.request("/api/auth/sign-in/email", {
            body: JSON.stringify({ email: "a@example.com", password: oversizedName }),
            headers: {
                "content-type": "application/json"
            },
            method: "POST"
        });

        expect(response.status).toBe(payloadTooLarge);
        expect(await response.json()).toMatchObject({
            error: {
                code: "auth.tooLong"
            }
        });
    });
});
