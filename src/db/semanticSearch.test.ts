import { type TestDatabase, containerTimeoutMs, startTestDatabase } from "./testDatabase";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SavedBookmark } from "../lib/bookmark";
import { createServer } from "node:http";
import { embeddingDimensions } from "./schema";
import { httpStatus } from "../lib/httpStatus";
import { user } from "./auth-schema";

const ephemeralPort = 0;

const semanticUserId = "semantic-user";
const otherSemanticUserId = "other-semantic-user";

// The one-hot vectors below must fit the column created by the migration.
const catDimension = 0;
const dogDimension = 1;
const otherDimension = 2;
const selectedValue = 1;
const unsetValue = 0;

const embeddingState = {
    dimensions: embeddingDimensions,
    fail: false
};

// One-hot vectors stand in for a real model: "cat" and "feline" share a direction, as do "dog"
// and "canine", so the tests can observe meaning-based matches without an external service.
const fakeEmbedding = (text: string, dimensions = embeddingDimensions): number[] => {
    const vector = Array.from({ length: dimensions }, () => unsetValue);

    if (/cat|feline/iu.test(text)) {
        vector[catDimension] = selectedValue;
    } else if (/dog|canine/iu.test(text)) {
        vector[dogDimension] = selectedValue;
    } else {
        vector[otherDimension] = selectedValue;
    }

    return vector;
};

const embeddingServer = createServer((request, response) => {
    if (embeddingState.fail) {
        response.writeHead(httpStatus.internalServerError).end();

        return;
    }

    const body: string[] = [];

    request.setEncoding("utf8");
    request.on("data", (chunk: string) => body.push(chunk));
    request.on("end", () => {
        const { input } = JSON.parse(body.join("")) as { input?: string };

        response.writeHead(httpStatus.ok, {
            "content-type": "application/json"
        });

        response.end(
            JSON.stringify({
                data: [
                    {
                        embedding: fakeEmbedding(input ?? "", embeddingState.dimensions)
                    }
                ]
            })
        );
    });
});

const state: { current?: TestDatabase } = {};

const getSetup = (): TestDatabase => {
    if (!state.current) {
        throw new Error("テスト用データベースが起動していません。");
    }

    return state.current;
};

interface SemanticBookmark {
    content: string | null;
    owner: string;
    path: string;
    title: string;
}

const saveSemanticBookmark = async ({ content, owner, path, title }: SemanticBookmark): Promise<string> => {
    const { saveBookmark } = await import("./bookmarks");
    const saved = await saveBookmark({
        preview: {
            content,
            description: null,
            faviconUrl: null,
            siteName: "example.com",
            thumbnailUrl: null,
            title
        },
        url: new URL(`https://example.com/${path}`),
        userId: owner,
        xPost: null
    });

    if (!saved) {
        throw new Error("テスト用ブックマークを保存できませんでした。");
    }

    return saved.id;
};

const searchBookmarks = async (query: string): Promise<SavedBookmark[]> => {
    const { listBookmarks } = await import("./bookmarks");

    return listBookmarks(query, "active", semanticUserId);
};

const bookmarkIds = async (query: string): Promise<string[]> =>
    (await searchBookmarks(query)).map((bookmark) => bookmark.id);

const bookmarkTitles = async (query: string): Promise<string[]> =>
    (await searchBookmarks(query)).map((bookmark) => bookmark.title);

beforeAll(async () => {
    const setup = await startTestDatabase();
    const { database } = setup;

    await new Promise<void>((resolve) => {
        embeddingServer.listen(ephemeralPort, "127.0.0.1", resolve);
    });

    const address = embeddingServer.address();

    if (!address || typeof address === "string") {
        throw new Error("テスト用埋め込みサーバーが起動していません。");
    }

    await database.insert(user).values([
        {
            createdAt: new Date(),
            email: "semantic@example.com",
            id: semanticUserId,
            name: "Semantic",
            updatedAt: new Date()
        },
        {
            createdAt: new Date(),
            email: "other-semantic@example.com",
            id: otherSemanticUserId,
            name: "Other semantic",
            updatedAt: new Date()
        }
    ]);

    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-thirty-two-characters";
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = setup.connectionUri;
    process.env.EMBEDDING_API_KEY = "test-key";
    process.env.EMBEDDING_BASE_URL = `http://127.0.0.1:${String(address.port)}`;
    process.env.EMBEDDING_MODEL = "test-model";
    process.env.ENABLE_SIGNUP = "false";

    state.current = setup;

    vi.resetModules();
}, containerTimeoutMs);

afterAll(async () => {
    embeddingServer.closeAllConnections();

    await new Promise<void>((resolve) => {
        embeddingServer.close(() => {
            resolve();
        });
    });

    await getSetup().client.end();
});

describe("semantic search", () => {
    it("appends matches from the embedding space after keyword matches", async () => {
        const { setBookmarkArchived } = await import("./bookmarks");

        await saveSemanticBookmark({
            content: null,
            owner: semanticUserId,
            path: "cats",
            title: "Cats"
        });

        await saveSemanticBookmark({
            content: "feline",
            owner: semanticUserId,
            path: "feline",
            title: "Animals"
        });

        await saveSemanticBookmark({
            content: null,
            owner: otherSemanticUserId,
            path: "other-cats",
            title: "Cats"
        });

        const archivedId = await saveSemanticBookmark({
            content: null,
            owner: semanticUserId,
            path: "archived-cats",
            title: "Cats history"
        });

        await setBookmarkArchived(archivedId, new Date(), semanticUserId);

        // The keyword hit keeps its position; the bookmark that only shares a meaning follows it.
        expect(await bookmarkTitles("cat")).toEqual(["Cats", "Animals"]);
    });

    it("saves the bookmark without a vector when the provider fails, then backfills it", async () => {
        const { backfillEmbeddings } = await import("./backfillEmbeddings");
        let canineId = "";

        embeddingState.fail = true;

        try {
            canineId = await saveSemanticBookmark({
                content: "canine",
                owner: semanticUserId,
                path: "canine",
                title: "Animals"
            });
        } finally {
            embeddingState.fail = false;
        }

        // Without a vector the row stays out of the semantic results until a backfill.
        expect(await bookmarkIds("dog")).not.toContain(canineId);

        await backfillEmbeddings(false);

        expect((await bookmarkIds("dog"))[0]).toBe(canineId);
    });

    it("falls back to keyword matches when the query embedding fails", async () => {
        embeddingState.fail = true;

        try {
            expect(await bookmarkTitles("cat")).toEqual(["Cats"]);
        } finally {
            embeddingState.fail = false;
        }
    });

    it("keeps the bookmark when the provider returns the wrong vector size, then re-embeds it with --force", async () => {
        const { backfillEmbeddings } = await import("./backfillEmbeddings");
        let wrongSizeId = "";

        embeddingState.dimensions = 1024;

        try {
            wrongSizeId = await saveSemanticBookmark({
                content: "canine",
                owner: semanticUserId,
                path: "wrong-size",
                title: "Animals"
            });
        } finally {
            embeddingState.dimensions = embeddingDimensions;
        }

        // The save succeeds without a usable vector, so the row only appears after a re-embed.
        expect(await bookmarkIds("dog")).not.toContain(wrongSizeId);

        await backfillEmbeddings(true);

        expect(await bookmarkIds("dog")).toContain(wrongSizeId);
    });
});

describe("forced re-embedding", () => {
    it("clears vectors before re-embedding so a failed run leaves nothing stale", async () => {
        const { backfillEmbeddings } = await import("./backfillEmbeddings");
        const dogId = await saveSemanticBookmark({
            content: "canine",
            owner: semanticUserId,
            path: "force",
            title: "Animals"
        });

        embeddingState.fail = true;

        try {
            await backfillEmbeddings(true);
        } finally {
            embeddingState.fail = false;
        }

        // Clearing runs before the provider calls, so no old vector survives a failed run.
        expect(await bookmarkIds("dog")).not.toContain(dogId);
    });
});
