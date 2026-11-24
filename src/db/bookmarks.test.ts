import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { user, verification } from "./auth-schema";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const migrationDirectory = new URL("../../drizzle/", import.meta.url);
const containerTimeoutMs = 120_000;
const oneBookmark = 1;
const noBookmarks = 0;
const guardIdentifier = "initial-signup-guard";

const userId = "user-a";
const otherUserId = "user-b";

interface TestSetup {
    client: ReturnType<typeof postgres>;
    database: ReturnType<typeof drizzle>;
}

const state: { current?: TestSetup } = {};

const getSetup = (): TestSetup => {
    if (!state.current) {
        throw new Error("テスト用データベースが起動していません。");
    }

    return state.current;
};

const applyMigrations = async (client: ReturnType<typeof postgres>): Promise<void> => {
    const files = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort();
    const statements = await Promise.all(
        files.map(async (file) => {
            const sql = await readFile(new URL(file, migrationDirectory), "utf8");

            return sql.split("--> statement-breakpoint").filter((statement) => statement.trim());
        })
    );

    await statements.flat().reduce(async (previous, statement) => {
        await previous;
        await client.unsafe(statement);
    }, Promise.resolve());
};

beforeAll(async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const client = postgres(container.getConnectionUri());
    const database = drizzle(client);

    await applyMigrations(client);
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
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.ENABLE_SIGNUP = "false";

    state.current = {
        client,
        database
    };

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
