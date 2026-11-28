import { type TestDatabase, containerTimeoutMs, startTestDatabase } from "./testDatabase";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { user } from "./auth-schema";

const userId = "editor";
const otherUserId = "other-editor";

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
            email: "editor@example.com",
            id: userId,
            name: "Editor",
            updatedAt: new Date()
        },
        {
            createdAt: new Date(),
            email: "other-editor@example.com",
            id: otherUserId,
            name: "Other Editor",
            updatedAt: new Date()
        }
    ]);

    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-thirty-two-characters";
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = setup.connectionUri;
    // Keep edits off the network even when the developer's own .env enables semantic search.
    delete process.env.EMBEDDING_API_KEY;
    process.env.ENABLE_SIGNUP = "false";

    state.current = setup;

    vi.resetModules();
}, containerTimeoutMs);

afterAll(async () => {
    await getSetup().client.end();
});

describe("bookmark editing", () => {
    it("updates the title and replaces its tags", async () => {
        const { listBookmarks, saveBookmark } = await import("./bookmarks");
        const { updateBookmark } = await import("./bookmarkUpdate");
        const { listTags } = await import("./tags");
        const saved = await saveBookmark({
            preview: null,
            tagNames: ["Work", "Review"],
            url: new URL("https://example.com/edit-one"),
            userId,
            xPost: null
        });

        expect(saved).not.toBeNull();

        const updated = await updateBookmark({
            id: saved?.id ?? "",
            tags: ["Review", "News"],
            title: "Edited title",
            userId
        });

        expect(updated?.title).toBe("Edited title");
        expect(updated?.tags).toEqual(["Review", "News"]);

        const listed = (await listBookmarks({ query: "", scope: "active" }, userId)).find(
            (bookmark) => bookmark.id === saved?.id
        );

        expect(listed?.title).toBe("Edited title");
        // List responses use a stable alphabetical order; a changed update response keeps input order.
        expect(listed?.tags).toEqual(["News", "Review"]);

        const removedTagMatches = await listBookmarks(
            {
                query: "",
                scope: "active",
                tag: "work"
            },
            userId
        );

        expect(removedTagMatches).toEqual([]);
        expect((await listTags(userId)).map((tag) => tag.name)).not.toContain("Work");
    });

    it("refuses to update another user's bookmark", async () => {
        const { listBookmarks, saveBookmark } = await import("./bookmarks");
        const { updateBookmark } = await import("./bookmarkUpdate");
        const saved = await saveBookmark({
            preview: null,
            url: new URL("https://example.com/edit-private"),
            userId,
            xPost: null
        });

        expect(saved).not.toBeNull();

        expect(
            await updateBookmark({
                id: saved?.id ?? "",
                tags: [],
                title: "Hijacked",
                userId: otherUserId
            })
        ).toBeNull();

        const listed = (await listBookmarks({ query: "", scope: "active" }, userId)).find(
            (bookmark) => bookmark.id === saved?.id
        );

        expect(listed?.title).toBe(saved?.title);
    });

    it("clears every tag when the new list is empty", async () => {
        const { saveBookmark } = await import("./bookmarks");
        const { updateBookmark } = await import("./bookmarkUpdate");
        const saved = await saveBookmark({
            preview: null,
            tagNames: ["Solo"],
            url: new URL("https://example.com/edit-clear"),
            userId,
            xPost: null
        });

        const updated = await updateBookmark({
            id: saved?.id ?? "",
            tags: [],
            title: saved?.title ?? "",
            userId
        });

        expect(updated?.tags).toEqual([]);
    });
});
