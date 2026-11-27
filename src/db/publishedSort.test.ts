import { type SortBy, defaultSortBy } from "../lib/bookmarkSort";
import { type TestDatabase, containerTimeoutMs, startTestDatabase } from "./testDatabase";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bookmarks } from "./schema";
import { user } from "./auth-schema";

const userId = "published-sort-user";

const state: { current?: TestDatabase } = {};

const getSetup = (): TestDatabase => {
    if (!state.current) {
        throw new Error("テスト用データベースが起動していません。");
    }

    return state.current;
};

interface SortFixture {
    addedAt: string;
    publishedAt: string | null;
    title: string;
}

const sortBookmark = ({ addedAt, publishedAt, title }: SortFixture): Omit<typeof bookmarks.$inferInsert, "id"> => ({
    addedAt: new Date(addedAt),
    publishedAt: publishedAt ? new Date(publishedAt) : null,
    siteName: "example.com",
    title,
    url: `https://example.com/sort-${title}`,
    userId
});

beforeAll(async () => {
    const setup = await startTestDatabase();

    await setup.database.insert(user).values({
        createdAt: new Date(),
        email: "published@example.com",
        id: userId,
        name: "Published",
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

const sortedTitles = async (sortBy: SortBy, query = ""): Promise<string[]> => {
    const { listBookmarks } = await import("./bookmarks");
    const listed = await listBookmarks({ query, scope: "active", sortBy }, userId);

    return listed.map((bookmark) => bookmark.title);
};

describe("bookmark sorting", () => {
    beforeAll(async () => {
        await getSetup()
            .database.insert(bookmarks)
            .values([
                sortBookmark({
                    addedAt: "2024-01-01",
                    publishedAt: "2024-03-01",
                    title: "zebra"
                }),
                sortBookmark({
                    addedAt: "2024-02-01",
                    publishedAt: "2024-02-01",
                    title: "alpha"
                }),
                sortBookmark({
                    addedAt: "2024-03-01",
                    publishedAt: "2024-01-01",
                    title: "middle"
                }),
                sortBookmark({
                    addedAt: "2024-04-01",
                    publishedAt: null,
                    title: "undated"
                }),
                sortBookmark({
                    addedAt: "2024-05-01",
                    publishedAt: "2024-02-01",
                    title: "sameDate"
                })
            ]);
    });

    it("orders the list by every sort option", async () => {
        expect(await sortedTitles("newest")).toEqual(["sameDate", "undated", "middle", "alpha", "zebra"]);
        expect(await sortedTitles("oldest")).toEqual(["zebra", "alpha", "middle", "undated", "sameDate"]);
        expect(await sortedTitles("titleAsc")).toEqual(["alpha", "middle", "sameDate", "undated", "zebra"]);
        expect(await sortedTitles("titleDesc")).toEqual(["zebra", "undated", "sameDate", "middle", "alpha"]);
    });

    it("treats an undated bookmark as the oldest one and breaks ties by added date", async () => {
        expect(await sortedTitles("publishedNewest")).toEqual(["zebra", "sameDate", "alpha", "middle", "undated"]);
        expect(await sortedTitles("publishedOldest")).toEqual(["undated", "middle", "sameDate", "alpha", "zebra"]);
    });

    it("keeps search results in the default relevance order", async () => {
        expect(await sortedTitles("titleAsc", "example.com")).toEqual([
            "sameDate",
            "undated",
            "middle",
            "alpha",
            "zebra"
        ]);

        expect(await sortedTitles(defaultSortBy)).toEqual(["sameDate", "undated", "middle", "alpha", "zebra"]);
    });
});
