import { type TestDatabase, containerTimeoutMs, startTestDatabase } from "./testDatabase";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { user } from "./auth-schema";

const userId = "tag-owner";
const otherUserId = "other-tag-owner";

const state: { current?: TestDatabase } = {};

const getSetup = (): TestDatabase => {
    if (!state.current) {
        throw new Error("テスト用データベースが起動していません。");
    }

    return state.current;
};

beforeAll(async () => {
    const setup = await startTestDatabase();
    const { database } = setup;

    await database.insert(user).values([
        {
            createdAt: new Date(),
            email: "tag-owner@example.com",
            id: userId,
            name: "Tag Owner",
            updatedAt: new Date()
        },
        {
            createdAt: new Date(),
            email: "other-tag-owner@example.com",
            id: otherUserId,
            name: "Other Tag Owner",
            updatedAt: new Date()
        }
    ]);

    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-thirty-two-characters";
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = setup.connectionUri;
    // Keep saves off the network even when the developer's own .env enables semantic search.
    delete process.env.EMBEDDING_API_KEY;
    process.env.ENABLE_SIGNUP = "false";

    state.current = setup;

    vi.resetModules();
}, containerTimeoutMs);

afterAll(async () => {
    await getSetup().client.end();
});

const findTag = async (name: string, owner = userId): Promise<{ color: string | null; count: number; id: string }> => {
    const { listTags } = await import("./tags");
    const tag = (await listTags(owner)).find((candidate) => candidate.name === name);

    if (!tag) {
        throw new Error(`Tag not found: ${name}`);
    }

    return tag;
};

const saveTaggedBookmark = async (path: string, tagNames: string[], owner = userId): Promise<string> => {
    const { saveBookmark } = await import("./bookmarks");
    const saved = await saveBookmark({
        preview: null,
        tagNames,
        url: new URL(`https://example.com/${path}`),
        userId: owner,
        xPost: null
    });

    if (!saved) {
        throw new Error(`Bookmark was not saved: ${path}`);
    }

    return saved.id;
};

describe("tag management", () => {
    it("renames a tag and every bookmark that uses it", async () => {
        const { updateTag } = await import("./tags");
        const { listBookmarks } = await import("./bookmarks");
        const first = await saveTaggedBookmark("rename-one", ["RenameMe"]);
        const second = await saveTaggedBookmark("rename-two", ["RenameMe"]);

        const tag = await findTag("RenameMe");

        expect(
            await updateTag({
                color: "#30a46c",
                id: tag.id,
                name: "Renamed",
                userId
            })
        ).toBe(true);

        const renamed = await findTag("Renamed");

        expect(renamed).toMatchObject({ color: "#30a46c", count: 2 });

        const tagsByBookmark = new Map(
            (await listBookmarks({ query: "", scope: "active" }, userId)).map((bookmark) => [
                bookmark.id,
                bookmark.tags
            ])
        );

        expect(tagsByBookmark.get(first)).toEqual(["Renamed"]);
        expect(tagsByBookmark.get(second)).toEqual(["Renamed"]);
    });

    it("merges into an existing tag and keeps the target's color", async () => {
        const { listTags, updateTag } = await import("./tags");
        const moved = await saveTaggedBookmark("merge-source", ["MergeFrom"]);
        await saveTaggedBookmark("merge-target", ["MergeInto"]);

        const source = await findTag("MergeFrom");
        const target = await findTag("MergeInto");

        expect(
            await updateTag({
                color: "#e93d82",
                id: target.id,
                name: "MergeInto",
                userId
            })
        ).toBe(true);

        expect(
            await updateTag({
                color: "#1e3a8a",
                id: source.id,
                name: "mergeinto",
                userId
            })
        ).toBe(true);

        const merged = await findTag("MergeInto");

        expect(merged).toMatchObject({ color: "#e93d82", count: 2 });
        expect((await listTags(userId)).map((candidate) => candidate.name)).not.toContain("MergeFrom");

        const { listBookmarks } = await import("./bookmarks");
        const saved = (await listBookmarks({ query: "", scope: "active" }, userId)).find(
            (bookmark) => bookmark.id === moved
        );

        expect(saved?.tags).toEqual(["MergeInto"]);
    });
});

describe("tag cleanup and ownership", () => {
    it("removes a tag without deleting its bookmarks", async () => {
        const { deleteTag, listTags } = await import("./tags");
        const { listBookmarks } = await import("./bookmarks");
        const bookmarkId = await saveTaggedBookmark("delete-me", ["DeleteMe"]);
        const tag = await findTag("DeleteMe");

        expect(await deleteTag(tag.id, userId)).toBe(true);

        const saved = (await listBookmarks({ query: "", scope: "active" }, userId)).find(
            (bookmark) => bookmark.id === bookmarkId
        );

        expect(saved).toBeDefined();
        expect(saved?.tags).toEqual([]);
        expect((await listTags(userId)).map((candidate) => candidate.name)).not.toContain("DeleteMe");
    });

    it("only changes tags owned by the user", async () => {
        const { deleteTag, listTags, updateTag } = await import("./tags");
        await saveTaggedBookmark("owned", ["Owned"]);
        await saveTaggedBookmark("other-owned", ["OtherOwned"], otherUserId);

        const others = await findTag("OtherOwned", otherUserId);

        expect(
            await updateTag({
                color: null,
                id: others.id,
                name: "Stolen",
                userId
            })
        ).toBe(false);

        expect(await deleteTag(others.id, userId)).toBe(false);

        expect(
            await updateTag({
                color: null,
                id: "00000000-0000-4000-8000-000000000000",
                name: "Missing",
                userId
            })
        ).toBe(false);

        expect((await listTags(otherUserId)).map((candidate) => candidate.name)).toContain("OtherOwned");
        expect((await listTags(userId)).map((candidate) => candidate.name)).toContain("Owned");
    });
});
