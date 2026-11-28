import { type TestDatabase, containerTimeoutMs, startTestDatabase } from "../db/testDatabase";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { apikey, user } from "../db/auth-schema";
import type { McpAuthOutcome } from "./tokenAuth";
import { eq } from "drizzle-orm";

const userId = "user-a";
const unauthorizedStatus = 401;
const forbiddenStatus = 403;
const tokenLimit = 120;
const requestId = 1;
const okStatus = 200;

const state: { current?: TestDatabase } = {};

const getSetup = (): TestDatabase => {
    if (!state.current) {
        throw new Error("テスト用データベースが起動していません。");
    }

    return state.current;
};

beforeAll(async () => {
    const setup = await startTestDatabase();

    await setup.database.insert(user).values({
        createdAt: new Date(),
        email: "a@example.com",
        id: userId,
        name: "A",
        updatedAt: new Date()
    });

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

const createToken = async (): Promise<string> => {
    const { auth } = await import("../lib/auth");
    const created = await auth.api.createApiKey({
        body: {
            name: "test",
            permissions: {
                bookmarks: ["read"]
            },
            userId
        }
    });

    return created.key;
};

describe("MCP token authentication", () => {
    it("authenticates a valid bearer token", async () => {
        const { authenticateMcpToken } = await import("./tokenAuth");
        const token = await createToken();
        const outcome = await authenticateMcpToken(
            new Request("http://localhost:3300/api/mcp", {
                headers: {
                    authorization: `Bearer ${token}`
                }
            })
        );

        expect(outcome).toMatchObject({
            identity: {
                permissions: {
                    bookmarks: ["read"]
                },
                userId
            },
            status: "authenticated"
        });
    });

    it("rejects an unknown token", async () => {
        const { authenticateMcpToken } = await import("./tokenAuth");
        const outcome = await authenticateMcpToken(
            new Request("http://localhost:3300/api/mcp", {
                headers: {
                    authorization: "Bearer unknown"
                }
            })
        );

        expect(outcome.status).toBe("unauthorized");
    });

    it("limits one token to 120 authenticated requests per minute", async () => {
        const { authenticateMcpToken } = await import("./tokenAuth");
        const token = await createToken();
        const request = (): Promise<McpAuthOutcome> =>
            authenticateMcpToken(
                new Request("http://localhost:3300/api/mcp", {
                    headers: {
                        authorization: `Bearer ${token}`
                    }
                })
            );

        const outcomes = await Promise.all(Array.from({ length: tokenLimit }, async () => request()));

        expect(outcomes.every((outcome) => outcome.status === "authenticated")).toBe(true);
        expect((await request()).status).toBe("rateLimited");
    });

    it("stops accepting a revoked token", async () => {
        const { db } = await import("../db");
        const token = await createToken();
        const { auth } = await import("../lib/auth");
        const verified = await auth.api.verifyApiKey({
            body: {
                key: token
            }
        });

        if (!verified.key) {
            throw new Error("Token was not created.");
        }

        await db.delete(apikey).where(eq(apikey.id, verified.key.id));

        const { authenticateMcpToken } = await import("./tokenAuth");
        const outcome = await authenticateMcpToken(
            new Request("http://localhost:3300/api/mcp", {
                headers: {
                    authorization: `Bearer ${token}`
                }
            })
        );

        expect(outcome.status).toBe("unauthorized");
    });
});

describe("MCP endpoint", () => {
    it("serves an authenticated request and marks it no-store", async () => {
        const { mcpApi } = await import("../mcpApi");
        const token = await createToken();
        const response = await mcpApi.request("/api/mcp", {
            body: JSON.stringify({
                id: requestId,
                jsonrpc: "2.0",
                method: "tools/list"
            }),
            headers: {
                accept: "application/json, text/event-stream",
                authorization: `Bearer ${token}`,
                "content-type": "application/json",
                host: "localhost:3300"
            },
            method: "POST"
        });

        expect(response.status).toBe(okStatus);
        expect(response.headers.get("cache-control")).toBe("no-store");
    });
});

describe("MCP endpoint guards", () => {
    it("rejects a request without a token", async () => {
        const { mcpApi } = await import("../mcpApi");
        const response = await mcpApi.request("/api/mcp", {
            headers: {
                host: "localhost:3300"
            }
        });

        expect(response.status).toBe(unauthorizedStatus);
    });

    it("rejects an unexpected host", async () => {
        const { mcpApi } = await import("../mcpApi");
        const response = await mcpApi.request("/api/mcp", {
            headers: {
                host: "evil.example"
            }
        });

        expect(response.status).toBe(forbiddenStatus);
    });
});
