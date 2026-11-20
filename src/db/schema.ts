import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const bookmarks = pgTable("bookmarks", {
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    description: text(),
    faviconUrl: text(),
    id: uuid().primaryKey().defaultRandom(),
    siteName: text().notNull(),
    thumbnailUrl: text(),
    title: text().notNull(),
    url: text().notNull().unique()
});

export { bookmarks };
