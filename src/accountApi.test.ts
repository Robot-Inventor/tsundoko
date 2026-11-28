import { beforeAll, describe, expect, it, vi } from "vitest";

const payloadTooLarge = 413;
const oversizedValueLength = 20_000;
const oversizedSortBy = "x".repeat(oversizedValueLength);

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
