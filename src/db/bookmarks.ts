import type { BookmarkPreview, SavedBookmark } from "../lib/bookmark";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import type { PreviewData } from "../lib/preview";
import type { XPostThumbnail } from "../lib/xPost";
import { bookmarks } from "./schema";
import { db } from "./index";
import { normalizeBookmarkUrl } from "../lib/bookmarkUrl";
import { saveThumbnail } from "../lib/thumbnailStore";

type BookmarkRow = typeof bookmarks.$inferSelect;

const toSavedBookmark = (row: BookmarkRow): SavedBookmark => ({
    addedAt: row.addedAt.toISOString(),
    description: row.description,
    faviconUrl: row.faviconUrl,
    id: row.id,
    siteName: row.siteName,
    thumbnailFit: row.thumbnailFile === null ? "center" : "top",
    thumbnailUrl: row.thumbnailUrl,
    title: row.title,
    url: row.url
});

const bookmarkExists = async (url: string): Promise<boolean> => {
    const existing = await db.select({ id: bookmarks.id }).from(bookmarks).where(eq(bookmarks.url, url));

    return Boolean(existing.length);
};

// `%` and `_` are LIKE wildcards and `\` escapes them, so all three must be escaped for a literal match.
const likePattern = (query: string): string => `%${query.replace(/[\\%_]/gu, "\\$&")}%`;

const listBookmarks = async (query: string): Promise<SavedBookmark[]> => {
    const condition = query
        ? or(
              ilike(bookmarks.title, likePattern(query)),
              ilike(bookmarks.description, likePattern(query)),
              ilike(bookmarks.siteName, likePattern(query)),
              ilike(bookmarks.url, likePattern(query))
          )
        : sql`true`;

    const rows = await db
        .select()
        .from(bookmarks)
        .where(condition)
        .orderBy(desc(bookmarks.addedAt), desc(bookmarks.id));

    return rows.map(toSavedBookmark);
};

const getBookmarkImageUrls = async (
    id: string
): Promise<Pick<BookmarkRow, "faviconUrl" | "thumbnailFile" | "thumbnailUrl" | "url"> | null> => {
    const [row] = await db
        .select({
            faviconUrl: bookmarks.faviconUrl,
            thumbnailFile: bookmarks.thumbnailFile,
            thumbnailUrl: bookmarks.thumbnailUrl,
            url: bookmarks.url
        })
        .from(bookmarks)
        .where(eq(bookmarks.id, id));

    return row ?? null;
};

const insertBookmark = async (bookmark: BookmarkPreview & { id: string }): Promise<SavedBookmark | null> => {
    const [saved] = await db
        .insert(bookmarks)
        .values(bookmark)
        .onConflictDoNothing({ target: bookmarks.url })
        .returning();

    return saved ? toSavedBookmark(saved) : null;
};

const saveBookmark = async (
    url: URL,
    xPost: XPostThumbnail | null,
    preview: PreviewData | null
): Promise<SavedBookmark | null> => {
    const id = crypto.randomUUID();
    // Saving the file before the row keeps the stored path from outliving an actual file.
    // A failed save only loses the rendered thumbnail; the OG fallback still applies.
    const thumbnailFile = xPost ? await saveThumbnail(id, xPost.png).catch(() => null) : null;
    const bookmark = {
        description: preview?.description ?? null,
        faviconUrl: preview?.faviconUrl ?? null,
        siteName: xPost?.siteName ?? preview?.siteName ?? url.hostname,
        thumbnailFile,
        thumbnailUrl: preview?.thumbnailUrl ?? null,
        title: xPost?.title ?? preview?.title ?? url.hostname,
        url: normalizeBookmarkUrl(url)
    } as const satisfies BookmarkPreview;

    return insertBookmark({ ...bookmark, id });
};

export { bookmarkExists, getBookmarkImageUrls, listBookmarks, saveBookmark };
