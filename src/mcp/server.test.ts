import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { type } from "arktype";

const requestId = 1;

const toolsListResponse = type({
    "error?": {
        message: "string"
    },
    "result?": {
        "tools?": type({
            name: "string"
        }).array()
    }
});

beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-thirty-two-characters";
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/test";
    process.env.ENABLE_SIGNUP = "false";

    vi.resetModules();
});

const authInfo = (scopes: string[]): AuthInfo => ({
    clientId: "user-a",
    scopes,
    token: "test-token"
});

const callMcp = async (body: Record<string, unknown>, scopes: string[]): Promise<typeof toolsListResponse.infer> => {
    const { mcpHandler } = await import("./server");
    const response = await mcpHandler.fetch(
        new Request("http://localhost:3300/api/mcp", {
            body: JSON.stringify({ id: requestId, jsonrpc: "2.0", ...body }),
            headers: {
                accept: "application/json, text/event-stream",
                "content-type": "application/json"
            },
            method: "POST"
        }),
        { authInfo: authInfo(scopes) }
    );

    const text = await response.text();
    const data = text
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice("data: ".length);

    const parsed = toolsListResponse(JSON.parse(data ?? text));

    if (parsed instanceof type.errors) {
        throw new Error("Unexpected MCP response.");
    }

    return parsed;
};

describe("MCP tool visibility", () => {
    it("lists only read tools for a read token", async () => {
        const body = await callMcp({ method: "tools/list" }, ["bookmarks:read"]);
        const names = body.result?.tools?.map((tool) => tool.name) ?? [];

        expect(names).toEqual(["search_bookmarks", "get_bookmark", "list_tags"]);
    });

    it("lists read and write tools for a write token", async () => {
        const body = await callMcp({ method: "tools/list" }, ["bookmarks:read", "bookmarks:write"]);
        const names = body.result?.tools?.map((tool) => tool.name) ?? [];

        expect(names).toEqual([
            "search_bookmarks",
            "get_bookmark",
            "list_tags",
            "add_bookmark",
            "update_bookmark",
            "archive_bookmark"
        ]);
    });

    it("lists every tool for a delete token", async () => {
        const body = await callMcp({ method: "tools/list" }, ["bookmarks:read", "bookmarks:write", "bookmarks:delete"]);
        const names = body.result?.tools?.map((tool) => tool.name) ?? [];

        expect(names).toEqual([
            "search_bookmarks",
            "get_bookmark",
            "list_tags",
            "add_bookmark",
            "update_bookmark",
            "archive_bookmark",
            "delete_bookmark"
        ]);
    });

    it("refuses a disabled tool", async () => {
        const body = await callMcp(
            {
                method: "tools/call",
                params: {
                    arguments: {
                        id: "0194f1c4-0000-7000-8000-000000000000"
                    },
                    name: "delete_bookmark"
                }
            },
            ["bookmarks:read"]
        );

        expect(body.error?.message).toContain("disabled");
    });
});
