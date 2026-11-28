import { beforeAll, describe, expect, it, vi } from "vitest";

// The real static handlers pull in the Bun-only Hono adapter; the API wiring under test does not
// need them.
vi.mock("./spaStatic", () => ({
    serveAppAssets: async (_context: unknown, next: () => Promise<void>): Promise<void> => next(),
    serveAppHtml: async (_context: unknown, next: () => Promise<void>): Promise<void> => next(),
    serveShareGate: async (_context: unknown, next: () => Promise<void>): Promise<void> => next()
}));

const unauthorized = 401;
const tagUrl = "http://localhost/api/tags/00000000-0000-4000-8000-000000000000";

beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-thirty-two-characters";
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/test";

    vi.resetModules();
});

const requestTag = async (init: RequestInit): Promise<Response> => {
    const { default: server } = await import("./server");

    return server.fetch(new Request(tagUrl, init));
};

// The composed server is the only place that proves the auth middleware covers the tag
// sub-paths; mounting tagApi alone would hide a missing guard.
describe("tag mutation authentication", () => {
    it("rejects a tag update without a session", async () => {
        const response = await requestTag({
            body: JSON.stringify({ color: "#30a46c", name: "Renamed" }),
            headers: {
                "content-type": "application/json"
            },
            method: "PATCH"
        });

        expect(response.status).toBe(unauthorized);
    });

    it("rejects a tag deletion without a session", async () => {
        const response = await requestTag({
            method: "DELETE"
        });

        expect(response.status).toBe(unauthorized);
    });
});
