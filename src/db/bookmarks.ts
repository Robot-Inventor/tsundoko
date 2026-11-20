import type { BookmarkPreview, SavedBookmark } from "../lib/bookmark";
import { desc, eq } from "drizzle-orm";
import { bookmarks } from "./schema";
import { db } from "./index";

type BookmarkRow = typeof bookmarks.$inferSelect;

const toSavedBookmark = (row: BookmarkRow): SavedBookmark => ({
    addedAt: row.addedAt.toISOString(),
    description: row.description,
    faviconUrl: row.faviconUrl,
    id: row.id,
    siteName: row.siteName,
    thumbnailUrl: row.thumbnailUrl,
    title: row.title,
    url: row.url
});

const bookmarkExists = async (url: string): Promise<boolean> => {
    const existing = await db.select({ id: bookmarks.id }).from(bookmarks).where(eq(bookmarks.url, url));

    return Boolean(existing.length);
};

const listBookmarks = async (): Promise<SavedBookmark[]> => {
    const rows = await db.select().from(bookmarks).orderBy(desc(bookmarks.addedAt), desc(bookmarks.id));

    return rows.map(toSavedBookmark);
};

const insertBookmark = async (bookmark: BookmarkPreview): Promise<SavedBookmark | null> => {
    const [saved] = await db
        .insert(bookmarks)
        .values(bookmark)
        .onConflictDoNothing({ target: bookmarks.url })
        .returning();

    return saved ? toSavedBookmark(saved) : null;
};

export { bookmarkExists, insertBookmark, listBookmarks };
