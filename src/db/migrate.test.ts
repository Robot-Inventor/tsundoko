import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { readdir } from "node:fs/promises";

const containerTimeoutMs = 120_000;
const migrationDirectory = new URL("../../drizzle/", import.meta.url);

interface TestDatabase {
    client: ReturnType<typeof postgres>;
}

const state: { current?: TestDatabase } = {};

const getDatabase = (): TestDatabase => {
    if (!state.current) {
        throw new Error("テスト用データベースが起動していません。");
    }

    return state.current;
};

const countAppliedMigrations = async ({ client }: TestDatabase): Promise<number> => {
    const [row] = await client<Array<{ count: number }>>`
        select count(*)::int as count from drizzle.__drizzle_migrations
    `;

    return row.count;
};

beforeAll(async () => {
    const container = await new PostgreSqlContainer("pgvector/pgvector:pg16").start();

    state.current = {
        client: postgres(container.getConnectionUri())
    };

    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-thirty-two-characters";
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = container.getConnectionUri();
    // Keep startup migrations independent of a developer's semantic-search settings.
    delete process.env.EMBEDDING_API_KEY;
    process.env.ENABLE_SIGNUP = "false";

    vi.resetModules();
}, containerTimeoutMs);

afterAll(async () => {
    await getDatabase().client.end();
});

describe("startup migrations", () => {
    it("creates the schema on an empty database and can run again", async () => {
        const database = getDatabase();
        const { runMigrations } = await import("./migrate");
        const migrationCount = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).length;

        await runMigrations();

        const [table] = await database.client<Array<{ name: string | null }>>`
            select to_regclass('public.bookmarks') as name
        `;

        expect(table.name).toBe("bookmarks");
        expect(await countAppliedMigrations(database)).toBe(migrationCount);

        await runMigrations();

        expect(await countAppliedMigrations(database)).toBe(migrationCount);
    });
});
