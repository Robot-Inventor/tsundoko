/* oxlint-disable no-await-in-loop, react-doctor/async-await-in-loop -- Provider requests run one at a time to stay within rate limits. */
import { client, db } from "./index";
import { embed, embeddingInput, embeddingsEnabled } from "../lib/embedding";
import { eq, isNull, sql } from "drizzle-orm";
import { bookmarks } from "./schema";

// Null embeddings are filled in place. `force` re-embeds every row, which is what a model change
// needs: old vectors come from a different embedding space and cannot be mixed with new ones.
const backfillEmbeddings = async (force: boolean): Promise<void> => {
    if (!embeddingsEnabled) {
        throw new Error("EMBEDDING_API_KEY が設定されていないため、埋め込みを生成できません。");
    }

    if (force) {
        // Clearing up front keeps an interrupted run from leaving two embedding spaces mixed: the
        // rows are either NULL or new, never stale. A rerun fills the rest.
        await db.update(bookmarks).set({ embedding: null });
    }

    const targets = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(force ? sql`true` : isNull(bookmarks.embedding));

    const failed: string[] = [];

    for (const { id } of targets) {
        // Only the ids are held in memory; the article body is read per row so a large library
        // does not load every document at once.
        const [row] = await db
            .select({
                content: bookmarks.content,
                description: bookmarks.description,
                title: bookmarks.title
            })
            .from(bookmarks)
            .where(eq(bookmarks.id, id));

        if (row) {
            const embedding = await embed(embeddingInput(row), "backfill");

            if (embedding) {
                await db.update(bookmarks).set({ embedding }).where(eq(bookmarks.id, id));
            } else {
                failed.push(id);
            }
        }
    }

    // oxlint-disable-next-line no-console -- A one-shot CLI script reports its result on stdout.
    console.log(
        `埋め込みを生成しました：${String(targets.length - failed.length)}件（失敗：${String(failed.length)}件）`
    );
};

if (import.meta.main) {
    await backfillEmbeddings(process.argv.includes("--force"));
    await client.end();
}

export { backfillEmbeddings };
