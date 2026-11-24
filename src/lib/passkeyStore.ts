import { and, desc, eq, sql } from "drizzle-orm";
import type { PasskeySummary } from "./passkey";
import { db } from "../db";
import { passkey } from "../db/auth-schema";
import { resolvePasskeyName } from "./passkeyPolicy";

type DeletePasskeyResult = "deleted" | "last" | "not-found";

// One passkey must always survive, because it is the only way to sign in.
const lastPasskeyCount = 1;

const listPasskeySummaries = async (userId: string): Promise<PasskeySummary[]> => {
    const rows = await db
        .select({
            aaguid: passkey.aaguid,
            createdAt: passkey.createdAt,
            id: passkey.id,
            lastUsedAt: passkey.lastUsedAt,
            name: passkey.name
        })
        .from(passkey)
        .where(eq(passkey.userId, userId))
        .orderBy(desc(passkey.createdAt));

    // Public keys, counters, and transports never leave the server.
    return rows.map((row) => ({
        createdAt: row.createdAt?.toISOString() ?? null,
        id: row.id,
        lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
        name: resolvePasskeyName(row.name, row.aaguid)
    }));
};

const deletePasskey = async (userId: string, id: string): Promise<DeletePasskeyResult> =>
    db.transaction(async (transaction) => {
        // Locking the owner row serializes deletes for this user. The count below then runs after
        // any concurrent delete has committed, so two tabs cannot remove the last two passkeys.
        await transaction.execute(sql`select id from "user" where id = ${userId} for update`);

        const owned = await transaction.select({ id: passkey.id }).from(passkey).where(eq(passkey.userId, userId));

        if (!owned.some((row) => row.id === id)) {
            return "not-found";
        }

        if (owned.length <= lastPasskeyCount) {
            return "last";
        }

        await transaction.delete(passkey).where(and(eq(passkey.id, id), eq(passkey.userId, userId)));

        return "deleted";
    });

export { deletePasskey, listPasskeySummaries };
