import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const bookmarks = pgTable("bookmarks", {
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // Null for active bookmarks; a timestamp marks the bookmark as archived.
    archivedAt: timestamp({ withTimezone: true }),
    // Article body as sanitized Markdown, searched but never sent to the client.
    // Null when extraction failed or the page is an X post.
    content: text(),
    description: text(),
    faviconUrl: text(),
    id: uuid().primaryKey().defaultRandom(),
    siteName: text().notNull(),
    // Relative path under the data directory when the thumbnail is stored locally (e.g. X post renders).
    thumbnailFile: text(),
    thumbnailUrl: text(),
    title: text().notNull(),
    url: text().notNull().unique()
});

export { bookmarks };
