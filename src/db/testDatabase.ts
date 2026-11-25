import { readFile, readdir } from "node:fs/promises";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const migrationDirectory = new URL("../../drizzle/", import.meta.url);
const containerTimeoutMs = 120_000;

interface TestDatabase {
    client: ReturnType<typeof postgres>;
    connectionUri: string;
    database: ReturnType<typeof drizzle>;
}

// Starts a throwaway Postgres with pgvector and replays the committed migrations against it, the
// same way production applies them at boot.
const startTestDatabase = async (): Promise<TestDatabase> => {
    const container = await new PostgreSqlContainer("pgvector/pgvector:pg16").start();
    const connectionUri = container.getConnectionUri();
    const client = postgres(connectionUri);
    const files = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort();
    const statements = await Promise.all(
        files.map(async (file) => {
            const sql = await readFile(new URL(file, migrationDirectory), "utf8");

            return sql.split("--> statement-breakpoint").filter((statement) => statement.trim());
        })
    );

    await statements
        .flat()
        .reduce<Promise<unknown>>(
            (previous, statement) => previous.then(() => client.unsafe(statement)),
            Promise.resolve()
        );

    return {
        client,
        connectionUri,
        database: drizzle(client)
    };
};

export { containerTimeoutMs, startTestDatabase, type TestDatabase };
