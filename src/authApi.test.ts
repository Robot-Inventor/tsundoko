import { beforeAll, describe, expect, it, vi } from "vitest";

const payloadTooLarge = 413;
const oversizedNameLength = 20_000;
const oversizedName = "x".repeat(oversizedNameLength);

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
