import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const bookmarks = pgTable("bookmarks", {
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
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
