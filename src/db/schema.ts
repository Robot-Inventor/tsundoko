import { index, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, vector } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// Fixed by the migration. Changing it means adding a migration that recreates the column and
// re-embedding every bookmark, because vectors from different models cannot be mixed.
const embeddingDimensions = 1536;

// A database enum keeps the column from holding a value the app cannot render. Adding "bottom"
// later needs a migration, which is acceptable for that safety.
// Exported (and used here) so drizzle-kit registers the type; an unexported enum is silently
// left out of generated migrations.
const thumbnailFitEnum = pgEnum("thumbnail_fit", ["top", "center"]);

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
        // Publication date from the page's OGP or structured data. Null when the page has no usable date.
        publishedAt: timestamp({ withTimezone: true }),
        siteName: text().notNull(),
        // Which edge of the card the thumbnail is cropped from. Rendered X posts are tall
        // screenshots, so they keep their top; Open Graph images are cropped from the center.
        thumbnailFit: thumbnailFitEnum().notNull().default("center"),
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

// A tag belongs to one user and keeps the spelling chosen when it was first used.
// normalizedName carries the case-insensitive key so two spellings cannot create two tags.
const tags = pgTable(
    "tags",
    {
        id: uuid().primaryKey().defaultRandom(),
        name: text().notNull(),
        normalizedName: text("normalized_name").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" })
    },
    (table) => [uniqueIndex("tags_user_id_normalized_name_idx").on(table.userId, table.normalizedName)]
);

const bookmarkTags = pgTable(
    "bookmark_tags",
    {
        bookmarkId: uuid("bookmark_id")
            .notNull()
            .references(() => bookmarks.id, { onDelete: "cascade" }),
        tagId: uuid("tag_id")
            .notNull()
            .references(() => tags.id, { onDelete: "cascade" })
    },
    (table) => [
        primaryKey({ columns: [table.bookmarkId, table.tagId] }),
        index("bookmark_tags_tag_id_idx").on(table.tagId)
    ]
);

export * from "./auth-schema";
export { bookmarkTags, bookmarks, embeddingDimensions, tags, thumbnailFitEnum };
