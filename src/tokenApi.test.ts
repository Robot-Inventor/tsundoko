import { type TestDatabase, containerTimeoutMs, startTestDatabase } from "./db/testDatabase";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AuthEnv } from "./authMiddleware";
import { Hono } from "hono";
import { tokenPermissions } from "./lib/tokenPermissions";
import { type } from "arktype";
import { user } from "./db/auth-schema";

// The composed server imports the Bun-only static handlers; the token guard does not need them.
vi.mock("./spaStatic", () => ({
    serveAppAssets: async (_context: unknown, next: () => Promise<void>): Promise<void> => next(),
    serveAppHtml: async (_context: unknown, next: () => Promise<void>): Promise<void> => next(),
    serveShareGate: async (_context: unknown, next: () => Promise<void>): Promise<void> => next()
}));

const userId = "user-a";
const otherUserId = "user-b";
const createdStatus = 201;
const noContentStatus = 204;
const unauthorizedStatus = 401;
const notFoundStatus = 404;

const createdTokenResponse = type({
    createdAt: "string",
    expiresAt: "string | null",
    id: "string",
    lastRequest: "string | null",
    name: "string | null",
    permissions: tokenPermissions,
    start: "string | null",
    token: "string"
});

const tokenListResponse = type({
    createdAt: "string",
    expiresAt: "string | null",
    id: "string",
    lastRequest: "string | null",
    name: "string | null",
    permissions: tokenPermissions,
    start: "string | null"
}).array();

const state: { current?: TestDatabase } = {};

const getSetup = (): TestDatabase => {
    if (!state.current) {
        throw new Error("テスト用データベースが起動していません。");
    }

    return state.current;
};

beforeAll(async () => {
    const setup = await startTestDatabase();

    await setup.database.insert(user).values([
        {
            createdAt: new Date(),
            email: "a@example.com",
            id: userId,
            name: "A",
            updatedAt: new Date()
        },
        {
            createdAt: new Date(),
            email: "b@example.com",
            id: otherUserId,
            name: "B",
            updatedAt: new Date()
        }
    ]);

    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-thirty-two-characters";
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = setup.connectionUri;
    delete process.env.EMBEDDING_API_KEY;
    process.env.ENABLE_SIGNUP = "false";

    state.current = setup;

    vi.resetModules();
}, containerTimeoutMs);

afterAll(async () => {
    await getSetup().client.end();
});

const buildApp = async (owner = userId): Promise<Hono<AuthEnv>> => {
    const { tokenApi } = await import("./tokenApi");

    return new Hono<AuthEnv>()
        .use("*", async (context, next) => {
            context.set("userId", owner);

            return next();
        })
        .route("/", tokenApi);
};

const requestServer = async (path: string, init: RequestInit): Promise<Response> => {
    const { default: server } = await import("./server");

    return server.fetch(new Request(`http://localhost:3300${path}`, init));
};

const createToken = async (app: Hono<AuthEnv>): Promise<typeof createdTokenResponse.infer> => {
    const response = await app.request("/api/tokens", {
        body: JSON.stringify({
            expiresInDays: 30,
            name: "Test token",
            permissions: {
                bookmarks: ["read", "write"]
            }
        }),
        headers: {
            "content-type": "application/json"
        },
        method: "POST"
    });

    const parsed = createdTokenResponse(await response.json());

    if (response.status !== createdStatus || parsed instanceof type.errors) {
        throw new Error("Token was not created.");
    }

    return parsed;
};

describe("token API", () => {
    it("creates, lists, and revokes a token", async () => {
        const app = await buildApp();
        const created = await createToken(app);

        expect(created.token.startsWith("tsd_")).toBe(true);
        expect(created.permissions).toEqual({ bookmarks: ["read", "write"] });

        const listResponse = await app.request("/api/tokens");
        const listed = tokenListResponse(await listResponse.json());

        if (listed instanceof type.errors) {
            throw new Error("Token list was invalid.");
        }

        expect(listed.map((token) => token.id)).toContain(created.id);

        const { authenticateMcpToken } = await import("./mcp/tokenAuth");
        const before = await authenticateMcpToken(
            new Request("http://localhost:3300/api/mcp", {
                headers: {
                    authorization: `Bearer ${created.token}`
                }
            })
        );

        expect(before.status).toBe("authenticated");

        const deleteResponse = await app.request(`/api/tokens/${created.id}`, { method: "DELETE" });

        expect(deleteResponse.status).toBe(noContentStatus);

        const after = await authenticateMcpToken(
            new Request("http://localhost:3300/api/mcp", {
                headers: {
                    authorization: `Bearer ${created.token}`
                }
            })
        );

        expect(after.status).toBe("unauthorized");
    });

    it("keeps one user's token hidden from another", async () => {
        const ownerApp = await buildApp();
        const created = await createToken(ownerApp);
        const strangerApp = await buildApp(otherUserId);

        const listResponse = await strangerApp.request("/api/tokens");
        const listed = tokenListResponse(await listResponse.json());

        if (listed instanceof type.errors) {
            throw new Error("Token list was invalid.");
        }

        expect(listed.map((token) => token.id)).not.toContain(created.id);

        const deleteResponse = await strangerApp.request(`/api/tokens/${created.id}`, { method: "DELETE" });

        expect(deleteResponse.status).toBe(notFoundStatus);
    });
});

describe("token route authentication", () => {
    it("rejects an unauthenticated token request through the composed server", async () => {
        const response = await requestServer("/api/tokens", {
            body: JSON.stringify({
                expiresInDays: 30,
                name: "No session",
                permissions: {
                    bookmarks: ["read"]
                }
            }),
            headers: {
                "content-type": "application/json"
            },
            method: "POST"
        });

        expect(response.status).toBe(unauthorizedStatus);
    });
});
