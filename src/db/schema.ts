import { index, pgTable, text, timestamp, uniqueIndex, uuid, vector } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// Fixed by the migration. Changing it means adding a migration that recreates the column and
// re-embedding every bookmark, because vectors from different models cannot be mixed.
const embeddingDimensions = 1536;

const bookmarks = pgTable(
    "bookmarks",
    {
        addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
        // Null for active bookmarks; a timestamp marks the bookmark as archived.
        archivedAt: timestamp({ withTimezone: true }),
        // Article body as sanitized Markdown, searched but never sent to the client.
        // Null when extraction failed or the page is an X post.
        content: text(),
        description: text(),
        // Null when the embedding request failed or semantic search is off; those rows stay keyword-only.
        embedding: vector({ dimensions: embeddingDimensions }),
        faviconUrl: text(),
        id: uuid().primaryKey().defaultRandom(),
        siteName: text().notNull(),
        // Relative path under the data directory when the thumbnail is stored locally (e.g. X post renders).
        thumbnailFile: text(),
        thumbnailUrl: text(),
        title: text().notNull(),
        url: text().notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" })
    },
    (table) => [
        uniqueIndex("bookmarks_user_id_url_idx").on(table.userId, table.url),
        index("bookmarks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
    ]
);

export * from "./auth-schema";
export { bookmarks, embeddingDimensions };
