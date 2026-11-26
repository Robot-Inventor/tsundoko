import { type TestDatabase, containerTimeoutMs, startTestDatabase } from "./db/testDatabase";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AuthEnv } from "./authMiddleware";
import { Hono } from "hono";
import { bookmarks } from "./db/schema";
import { type } from "arktype";
import { user } from "./db/auth-schema";

const userId = "sort-settings-user";
const noContent = 204;
const badRequest = 400;
const ok = 200;

const listedBookmarks = type({ title: "string" }).array();

const state: { current?: TestDatabase } = {};

const getSetup = (): TestDatabase => {
    if (!state.current) {
        throw new Error("テスト用データベースが起動していません。");
    }

    return state.current;
};

const accountApp = async (): Promise<Hono<AuthEnv>> => {
    const { accountApi } = await import("./accountApi");
    const app = new Hono<AuthEnv>();

    app.use("*", async (context, next) => {
        context.set("sessionStartedAt", new Date());
        context.set("userId", userId);
        await next();
    });

    app.route("/", accountApi);

    return app;
};

const bookmarkApp = async (): Promise<Hono<{ Variables: { userId: string } }>> => {
    const { bookmarkApi } = await import("./bookmarkApi");
    const app = new Hono<{ Variables: { userId: string } }>();

    app.use("*", async (context, next) => {
        context.set("userId", userId);
        await next();
    });

    app.route("/", bookmarkApi);

    return app;
};

const jsonPatch = (body: object): RequestInit => ({
    body: JSON.stringify(body),
    headers: {
        "content-type": "application/json"
    },
    method: "PATCH"
});

const titles = async (response: Response): Promise<string[]> => {
    const parsed = listedBookmarks(await response.json());

    if (parsed instanceof type.errors) {
        throw new Error(parsed.summary);
    }

    return parsed.map((bookmark) => bookmark.title);
};

beforeAll(async () => {
    const setup = await startTestDatabase();

    await setup.database.insert(user).values({
        createdAt: new Date(),
        email: "sort@example.com",
        id: userId,
        name: "Sort",
        updatedAt: new Date()
    });

    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-thirty-two-characters";
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = setup.connectionUri;
    delete process.env.EMBEDDING_API_KEY;

    state.current = setup;

    vi.resetModules();
}, containerTimeoutMs);

afterAll(async () => {
    await getSetup().client.end();
});

describe("account sort settings API", () => {
    it("saves each scope's sort option and returns them from GET /api/me", async () => {
        const app = await accountApp();
        const saved = await app.request("/api/me", jsonPatch({ sortByActive: "oldest", sortByArchived: "titleAsc" }));

        expect(saved.status).toBe(noContent);

        const response = await app.request("/api/me");

        expect(await response.json()).toMatchObject({
            sortByActive: "oldest",
            sortByArchived: "titleAsc"
        });
    });

    it("rejects an unknown sort option", async () => {
        const app = await accountApp();
        const response = await app.request("/api/me", jsonPatch({ sortByActive: "unknown" }));

        expect(response.status).toBe(badRequest);
        expect(await response.json()).toMatchObject({
            error: {
                code: "auth.invalidSortBy"
            }
        });
    });
});

describe("bookmark list sort API", () => {
    it("orders the list by the requested sort option", async () => {
        const { database } = getSetup();

        await database.insert(bookmarks).values([
            {
                addedAt: new Date("2024-01-01T00:00:00.000Z"),
                siteName: "example.com",
                title: "zebra",
                url: "https://example.com/api-zebra",
                userId
            },
            {
                addedAt: new Date("2024-02-01T00:00:00.000Z"),
                siteName: "example.com",
                title: "alpha",
                url: "https://example.com/api-alpha",
                userId
            },
            {
                addedAt: new Date("2024-03-01T00:00:00.000Z"),
                siteName: "example.com",
                title: "middle",
                url: "https://example.com/api-middle",
                userId
            }
        ]);

        const app = await bookmarkApp();
        const response = await app.request("/api/bookmarks?scope=active&sortBy=titleAsc");

        expect(response.status).toBe(ok);
        expect(await titles(response)).toEqual(["alpha", "middle", "zebra"]);
    });

    it("falls back to the default order for an unknown sort option", async () => {
        const app = await bookmarkApp();
        const response = await app.request("/api/bookmarks?scope=active&sortBy=unknown");

        expect(response.status).toBe(ok);
        expect(await titles(response)).toEqual(["middle", "alpha", "zebra"]);
    });
});
