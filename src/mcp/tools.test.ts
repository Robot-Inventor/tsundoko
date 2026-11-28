// oxlint-disable max-lines -- The MCP tool scenarios share one database container; splitting them would start another.
import { type TestDatabase, containerTimeoutMs, startTestDatabase } from "../db/testDatabase";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { type } from "arktype";
import { user } from "../db/auth-schema";

const requestId = 1;
const userId = "user-a";
const otherUserId = "user-b";
const pagerUserId = "user-pages";
const contentLimit = 100_000;
const longBodyLength = 100_005;

const toolResponse = type({
    "error?": {
        message: "string"
    },
    "result?": {
        "content?": type({
            text: "string"
        }).array()
    }
});

const searchResultItem = type({
    id: "string",
    title: "string"
});

const getBookmarkResult = type({
    content: "string | null",
    id: "string"
});

const tagResult = type({
    color: "string | null",
    id: "string",
    name: "string"
});

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
        },
        {
            createdAt: new Date(),
            email: "pages@example.com",
            id: pagerUserId,
            name: "Pages",
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

const authInfo = (scopes: string[], ownerId = userId): AuthInfo => ({
    clientId: ownerId,
    scopes,
    token: "test-token"
});

// oxlint-disable-next-line max-params -- The optional owner keeps every call site on one line.
const callTool = async (
    name: string,
    args: Record<string, unknown>,
    scopes: string[],
    ownerId = userId
): Promise<typeof toolResponse.infer> => {
    const { mcpHandler } = await import("./server");
    const response = await mcpHandler.fetch(
        new Request("http://localhost:3300/api/mcp", {
            body: JSON.stringify({
                id: requestId,
                jsonrpc: "2.0",
                method: "tools/call",
                params: {
                    arguments: args,
                    name
                }
            }),
            headers: {
                accept: "application/json, text/event-stream",
                "content-type": "application/json"
            },
            method: "POST"
        }),
        { authInfo: authInfo(scopes, ownerId) }
    );

    const text = await response.text();
    const data = text
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice("data: ".length);

    const parsed = toolResponse(JSON.parse(data ?? text));

    if (parsed instanceof type.errors) {
        throw new Error("Unexpected MCP response.");
    }

    return parsed;
};

const searchResult = async (
    scopes: string[],
    args: Record<string, unknown> = {},
    ownerId = userId
): Promise<Array<typeof searchResultItem.infer>> => {
    const body = await callTool("search_bookmarks", args, scopes, ownerId);
    const text = body.result?.content?.[0]?.text;
    const parsed = searchResultItem.array()(text ? JSON.parse(text) : []);

    if (parsed instanceof type.errors) {
        throw new Error("Unexpected search response.");
    }

    return parsed;
};

describe("MCP bookmark tools", () => {
    it("searches only the token owner's bookmarks", async () => {
        const { saveBookmark } = await import("../db/bookmarks");

        await saveBookmark({
            preview: null,
            url: new URL("https://example.com/mine"),
            userId,
            xPost: null
        });

        await saveBookmark({
            preview: null,
            url: new URL("https://example.com/other"),
            userId: otherUserId,
            xPost: null
        });

        const results = await searchResult(["bookmarks:read"]);

        expect(results.map((bookmark) => bookmark.title)).toEqual(["example.com"]);
    });

    it("returns the article body from get_bookmark", async () => {
        const { saveBookmark } = await import("../db/bookmarks");
        const saved = await saveBookmark({
            preview: {
                content: "Article body",
                description: null,
                faviconUrl: null,
                siteName: "Example",
                thumbnailUrl: null,
                title: "With body",
                url: "https://example.com/body"
            },
            url: new URL("https://example.com/body"),
            userId,
            xPost: null
        });

        if (!saved) {
            throw new Error("Bookmark was not saved.");
        }

        const body = await callTool("get_bookmark", { id: saved.id }, ["bookmarks:read"]);
        const parsed = getBookmarkResult(JSON.parse(body.result?.content?.[0]?.text ?? "{}"));

        if (parsed instanceof type.errors) {
            throw new Error("Unexpected bookmark response.");
        }

        expect(parsed).toMatchObject({ content: "Article body", id: saved.id });
    });

    it("reaches bookmarks beyond one page", async () => {
        const { saveBookmark } = await import("../db/bookmarks");
        const bookmarkCount = 55;
        const pageSize = 20;
        const seeded = await Promise.all(
            [...Array(bookmarkCount).keys()].map((index) =>
                saveBookmark({
                    preview: null,
                    url: new URL(`https://example.com/page/${String(index)}`),
                    userId: pagerUserId,
                    xPost: null
                })
            )
        );

        const expectedIds = seeded
            .map((bookmark) => {
                if (!bookmark) {
                    throw new Error("Bookmark was not saved.");
                }

                return bookmark.id;
            })
            .sort();

        const pages = await Promise.all(
            [...Array(Math.ceil(bookmarkCount / pageSize)).keys()].map((page) =>
                searchResult(["bookmarks:read"], { limit: pageSize, offset: page * pageSize }, pagerUserId)
            )
        );

        expect(
            pages
                .flat()
                .map((bookmark) => bookmark.id)
                .sort()
        ).toEqual(expectedIds);
    });
});

describe("MCP bookmark mutations", () => {
    it("truncates a long article within the advertised limit", async () => {
        const { saveBookmark } = await import("../db/bookmarks");
        const saved = await saveBookmark({
            preview: {
                content: "x".repeat(longBodyLength),
                description: null,
                faviconUrl: null,
                siteName: "Example",
                thumbnailUrl: null,
                title: "Long",
                url: "https://example.com/long"
            },
            url: new URL("https://example.com/long"),
            userId,
            xPost: null
        });

        if (!saved) {
            throw new Error("Bookmark was not saved.");
        }

        const body = await callTool("get_bookmark", { id: saved.id }, ["bookmarks:read"]);
        const parsed = getBookmarkResult(JSON.parse(body.result?.content?.[0]?.text ?? "{}"));

        if (parsed instanceof type.errors || parsed.content === null) {
            throw new Error("Unexpected bookmark response.");
        }

        expect(parsed.content.length).toBe(contentLimit);
        expect(parsed.content).toContain("[Content truncated");
    });

    it("deletes with a delete token", async () => {
        const { saveBookmark } = await import("../db/bookmarks");
        const saved = await saveBookmark({
            preview: null,
            url: new URL("https://example.com/delete-me"),
            userId,
            xPost: null
        });

        if (!saved) {
            throw new Error("Bookmark was not saved.");
        }

        const body = await callTool("delete_bookmark", { id: saved.id }, [
            "bookmarks:read",
            "bookmarks:write",
            "bookmarks:delete"
        ]);

        expect(body.result?.content?.[0]?.text).toContain('"deleted":true');
        expect((await searchResult(["bookmarks:read"])).some((bookmark) => bookmark.id === saved.id)).toBe(false);
    });

    it("refuses to delete with a write-only token", async () => {
        const body = await callTool("delete_bookmark", { id: "0194f1c4-0000-7000-8000-000000000000" }, [
            "bookmarks:read",
            "bookmarks:write"
        ]);

        expect(body.error?.message).toContain("disabled");
    });
});

const createTaggedBookmark = async (path: string, tagName: string): Promise<void> => {
    const { saveBookmark } = await import("../db/bookmarks");
    const saved = await saveBookmark({
        preview: null,
        url: new URL(`https://example.com/${path}`),
        userId,
        xPost: null
    });

    if (!saved) {
        throw new Error("Bookmark was not saved.");
    }

    await callTool(
        "update_bookmark",
        {
            id: saved.id,
            tags: [tagName]
        },
        ["bookmarks:read", "bookmarks:write"]
    );
};

// oxlint-disable-next-line max-lines-per-function -- The tag scenarios read better together than split further.
describe("MCP tag mutations", () => {
    it("updates a tag's name and color", async () => {
        const { listTags } = await import("../db/tags");
        await createTaggedBookmark("tag-update", "Teal");

        const tag = (await listTags(userId)).find((entry) => entry.name === "Teal");

        if (!tag) {
            throw new Error("Tag was not created.");
        }

        const updated = await callTool(
            "update_tag",
            {
                color: "#12A594",
                id: tag.id,
                name: "VRChatワールド"
            },
            ["bookmarks:read", "bookmarks:write"]
        );

        expect(updated.error).toBeUndefined();
        expect((await listTags(userId)).find((entry) => entry.id === tag.id)).toEqual({
            color: "#12a594",
            count: 1,
            id: tag.id,
            name: "VRChatワールド"
        });

        await callTool(
            "update_tag",
            {
                color: null,
                id: tag.id,
                name: "VRChatワールド"
            },
            ["bookmarks:read", "bookmarks:write"]
        );

        expect((await listTags(userId)).find((entry) => entry.id === tag.id)?.color).toBeNull();
    });

    it("keeps the merge target when a rename matches it", async () => {
        const { listTags } = await import("../db/tags");
        await createTaggedBookmark("merge-source", "MergeFrom");
        await createTaggedBookmark("merge-target", "MergeInto");

        const tags = await listTags(userId);
        const source = tags.find((entry) => entry.name === "MergeFrom");
        const target = tags.find((entry) => entry.name === "MergeInto");

        if (!source || !target) {
            throw new Error("Tags were not created.");
        }

        await callTool(
            "update_tag",
            {
                color: "#12a594",
                id: target.id,
                name: "MergeInto"
            },
            ["bookmarks:read", "bookmarks:write"]
        );

        const merged = await callTool(
            "update_tag",
            {
                color: "#0091ff",
                id: source.id,
                name: "MergeInto"
            },
            ["bookmarks:read", "bookmarks:write"]
        );

        const mergedTag = tagResult(JSON.parse(merged.result?.content?.[0]?.text ?? "{}"));

        if (mergedTag instanceof type.errors) {
            throw new Error("Unexpected tag response.");
        }

        expect(mergedTag).toEqual({
            color: "#12a594",
            id: target.id,
            name: "MergeInto"
        });

        expect((await listTags(userId)).map((entry) => entry.name)).not.toContain("MergeFrom");
    });

    it("rejects an invalid tag color", async () => {
        const body = await callTool(
            "update_tag",
            {
                color: "blue",
                id: "0194f1c4-0000-7000-8000-000000000000",
                name: "Teal"
            },
            ["bookmarks:read", "bookmarks:write"]
        );

        expect(body.result?.content?.[0]?.text).toContain("Invalid color");
    });
});
