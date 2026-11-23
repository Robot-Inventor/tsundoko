import type { BookmarkPreview, BookmarkScope, SavedBookmark } from "../lib/bookmark";
import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { deleteThumbnail, saveThumbnail } from "../lib/thumbnailStore";
import type { PreviewData } from "../lib/preview";
import type { XPostThumbnail } from "../lib/xPost";
import { bookmarks } from "./schema";
import { db } from "./index";
import { normalizeBookmarkUrl } from "../lib/bookmarkUrl";

type BookmarkRow = typeof bookmarks.$inferSelect;

// Client-facing columns: `content` stays search-only and `archivedAt` never leaves the server.
const bookmarkListItemColumns = {
    addedAt: bookmarks.addedAt,
    description: bookmarks.description,
    faviconUrl: bookmarks.faviconUrl,
    id: bookmarks.id,
    siteName: bookmarks.siteName,
    thumbnailFile: bookmarks.thumbnailFile,
    thumbnailUrl: bookmarks.thumbnailUrl,
    title: bookmarks.title,
    url: bookmarks.url
} as const;

// `content` is excluded from list reads: it can be ~100 KB per row and is only used for search.
type BookmarkListItem = Omit<BookmarkRow, "archivedAt" | "content">;

const toSavedBookmark = (row: BookmarkListItem): SavedBookmark => ({
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

const listBookmarks = async (query: string, scope: BookmarkScope): Promise<SavedBookmark[]> => {
    const searchCondition = query
        ? or(
              ilike(bookmarks.title, likePattern(query)),
              ilike(bookmarks.description, likePattern(query)),
              ilike(bookmarks.content, likePattern(query)),
              ilike(bookmarks.siteName, likePattern(query)),
              ilike(bookmarks.url, likePattern(query))
          )
        : sql`true`;

    const scopeCondition = scope === "active" ? isNull(bookmarks.archivedAt) : isNotNull(bookmarks.archivedAt);

    const rows = await db
        .select(bookmarkListItemColumns)
        .from(bookmarks)
        .where(and(searchCondition, scopeCondition))
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

// `content` is for search only and never reaches the client: `toSavedBookmark` omits it
// from every list and mutation response.
type BookmarkInsert = BookmarkPreview & { content: string | null; id: string };

const insertBookmark = async (bookmark: BookmarkInsert): Promise<SavedBookmark | null> => {
    const [saved] = await db
        .insert(bookmarks)
        .values(bookmark)
        .onConflictDoNothing({ target: bookmarks.url })
        .returning(bookmarkListItemColumns);

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
        content: preview?.content ?? null,
        description: preview?.description ?? null,
        faviconUrl: preview?.faviconUrl ?? null,
        siteName: xPost?.siteName ?? preview?.siteName ?? url.hostname,
        thumbnailFile,
        thumbnailUrl: preview?.thumbnailUrl ?? null,
        title: xPost?.title ?? preview?.title ?? url.hostname,
        url: normalizeBookmarkUrl(url)
    } as const satisfies Omit<BookmarkInsert, "id">;

    return insertBookmark({ ...bookmark, id });
};

const setBookmarkArchived = async (id: string, archivedAt: Date | null): Promise<SavedBookmark | null> => {
    const [row] = await db
        .update(bookmarks)
        .set({ archivedAt })
        .where(eq(bookmarks.id, id))
        .returning(bookmarkListItemColumns);

    return row ? toSavedBookmark(row) : null;
};

// Deletes the row first, then unlinks the locally stored thumbnail if there was one:
// a failed unlink only leaves an unreachable orphan file behind.
const deleteBookmark = async (id: string): Promise<boolean> => {
    const [row] = await db
        .delete(bookmarks)
        .where(eq(bookmarks.id, id))
        .returning({ thumbnailFile: bookmarks.thumbnailFile });

    if (!row) {
        return false;
    }

    if (row.thumbnailFile) {
        await deleteThumbnail(row.thumbnailFile).catch((error: unknown) => {
            // oxlint-disable-next-line no-console -- Server-side diagnostics are console's legitimate use.
            console.warn("Thumbnail file deletion failed:", error);
        });
    }

    return true;
};

export { bookmarkExists, deleteBookmark, getBookmarkImageUrls, listBookmarks, saveBookmark, setBookmarkArchived };
