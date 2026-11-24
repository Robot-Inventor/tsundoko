import { type TestDatabase, containerTimeoutMs, startTestDatabase } from "./testDatabase";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { user, verification } from "./auth-schema";

const oneBookmark = 1;
const noBookmarks = 0;
const guardIdentifier = "initial-signup-guard";

const userId = "user-a";
const otherUserId = "user-b";

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
    // Keep saves off the network even when the developer's own .env enables semantic search.
    delete process.env.EMBEDDING_API_KEY;
    process.env.ENABLE_SIGNUP = "false";

    state.current = setup;

    vi.resetModules();
}, containerTimeoutMs);

afterAll(async () => {
    await getSetup().client.end();
});

describe("initial signup guard", () => {
    it("allows only one claim", async () => {
        const { database } = getSetup();
        const guard = {
            expiresAt: new Date("9999-12-31T00:00:00.000Z"),
            identifier: guardIdentifier,
            value: "claim"
        } as const;

        await database.insert(verification).values({ ...guard, id: crypto.randomUUID() });

        await expect(database.insert(verification).values({ ...guard, id: crypto.randomUUID() })).rejects.toThrow();
    });
});

describe("bookmark ownership", () => {
    it("keeps bookmarks private to their owner", async () => {
        const { listBookmarks, saveBookmark } = await import("./bookmarks");
        const saved = await saveBookmark({
            preview: null,
            url: new URL("https://example.com/one"),
            userId,
            xPost: null
        });

        expect(saved).not.toBeNull();
        expect(await listBookmarks("", "active", userId)).toHaveLength(oneBookmark);
        expect(await listBookmarks("", "active", otherUserId)).toHaveLength(noBookmarks);
    });

    it("allows the same URL for different users", async () => {
        const { bookmarkExists, saveBookmark } = await import("./bookmarks");
        const url = new URL("https://example.com/shared");

        expect(await bookmarkExists(url.href, userId)).toBe(false);
        expect(
            await saveBookmark({
                preview: null,
                url,
                userId,
                xPost: null
            })
        ).not.toBeNull();

        expect(
            await saveBookmark({
                preview: null,
                url,
                userId: otherUserId,
                xPost: null
            })
        ).not.toBeNull();
    });

    it("allows the first account only, unless signups are enabled", async () => {
        const { database } = getSetup();
        const { signupAllowed } = await import("../lib/signupPolicy");

        expect(await signupAllowed()).toBe(false);

        await database.delete(user);

        expect(await signupAllowed()).toBe(true);

        await database.insert(user).values({
            createdAt: new Date(),
            email: "a@example.com",
            id: userId,
            name: "A",
            updatedAt: new Date()
        });

        expect(await signupAllowed()).toBe(false);

        process.env.ENABLE_SIGNUP = "true";
        vi.resetModules();
        const reloaded = await import("../lib/signupPolicy");

        expect(await reloaded.signupAllowed()).toBe(true);

        process.env.ENABLE_SIGNUP = "false";
    });

    it("refuses reads and changes through another user's id", async () => {
        const { deleteBookmark, getBookmarkImageUrls, saveBookmark, setBookmarkArchived } = await import("./bookmarks");
        const saved = await saveBookmark({
            preview: null,
            url: new URL("https://example.com/private"),
            userId,
            xPost: null
        });

        expect(saved).not.toBeNull();

        const id = saved?.id ?? "";

        expect(await getBookmarkImageUrls(id, otherUserId)).toBeNull();
        expect(await setBookmarkArchived(id, new Date(), otherUserId)).toBeNull();
        expect(await deleteBookmark(id, otherUserId)).toBe(false);
        expect(await getBookmarkImageUrls(id, userId)).not.toBeNull();
    });
});
