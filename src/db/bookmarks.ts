import type { BookmarkListFilter, BookmarkPreview, SavedBookmark } from "../lib/bookmark";
import { and, cosineDistance, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { attachTags, getBookmarkTags, tagFilterCondition, textSearchCondition } from "./bookmarkTags";
import { deleteThumbnail, saveThumbnail } from "../lib/thumbnailStore";
import { embed, embeddingInput } from "../lib/embedding";
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

// `content` and `embedding` are excluded from list reads: they are search-only internals.
type BookmarkListItem = Omit<BookmarkRow, "archivedAt" | "content" | "embedding" | "userId">;

const toSavedBookmark = (row: BookmarkListItem, tagNames: string[]): SavedBookmark => ({
    addedAt: row.addedAt.toISOString(),
    description: row.description,
    faviconUrl: row.faviconUrl,
    id: row.id,
    siteName: row.siteName,
    tags: tagNames,
    thumbnailFit: row.thumbnailFile === null ? "center" : "top",
    thumbnailUrl: row.thumbnailUrl,
    title: row.title,
    url: row.url
});

const bookmarkExists = async (url: string, userId: string): Promise<boolean> => {
    const existing = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(and(eq(bookmarks.url, url), eq(bookmarks.userId, userId)));

    return Boolean(existing.length);
};

// `%` and `_` are LIKE wildcards and `\` escapes them, so all three must be escaped for a literal match.
const likePattern = (query: string): string => `%${query.replace(/[\\%_]/gu, "\\$&")}%`;

// Semantic results are appended below the keyword matches; this bounds how far the list grows
// when a query matches none of the stored text but is still near everything in the embedding space.
const vectorResultLimit = 20;

const listBookmarks = async (
    { query, scope, tag = "" }: BookmarkListFilter,
    userId: string
): Promise<SavedBookmark[]> => {
    const pattern = query ? likePattern(query) : null;
    const tagCondition = tagFilterCondition(tag, userId);
    const searchCondition = textSearchCondition(pattern, userId);

    const scopeCondition = scope === "active" ? isNull(bookmarks.archivedAt) : isNotNull(bookmarks.archivedAt);

    // The embedding round trip runs alongside the keyword query instead of after it.
    const embeddingRequest = query ? embed(query, userId) : Promise.resolve(null);

    const keywordRows = await db
        .select(bookmarkListItemColumns)
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), searchCondition, scopeCondition, tagCondition))
        .orderBy(desc(bookmarks.addedAt), desc(bookmarks.id));

    let rows = keywordRows;
    const queryEmbedding = await embeddingRequest;

    if (queryEmbedding) {
        // Keyword matches keep their position; the vector pass is deduplicated against them below.
        // The HNSW index is shared across users and pgvector filters after the index scan, so a user
        // whose rows fall outside the candidate set can receive fewer results. That is acceptable for
        // this app's small, mostly single-user deployments.
        const vectorRows = await db
            .select(bookmarkListItemColumns)
            .from(bookmarks)
            .where(and(eq(bookmarks.userId, userId), scopeCondition, tagCondition, isNotNull(bookmarks.embedding)))
            .orderBy(cosineDistance(bookmarks.embedding, queryEmbedding))
            .limit(vectorResultLimit);

        const keywordIds = new Set(keywordRows.map((row) => row.id));
        rows = [...keywordRows, ...vectorRows.filter((row) => !keywordIds.has(row.id))];
    }

    const tagsByBookmark = await getBookmarkTags(
        rows.map((row) => row.id),
        userId
    );

    return rows.map((row) => toSavedBookmark(row, tagsByBookmark.get(row.id) ?? []));
};

const getBookmarkImageUrls = async (
    id: string,
    userId: string
): Promise<Pick<BookmarkRow, "faviconUrl" | "thumbnailFile" | "thumbnailUrl" | "url"> | null> => {
    const [row] = await db
        .select({
            faviconUrl: bookmarks.faviconUrl,
            thumbnailFile: bookmarks.thumbnailFile,
            thumbnailUrl: bookmarks.thumbnailUrl,
            url: bookmarks.url
        })
        .from(bookmarks)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

    return row ?? null;
};

// `content` is for search only and never reaches the client: `toSavedBookmark` omits it
// from every list and mutation response.
type BookmarkInsert = BookmarkPreview & {
    content: string | null;
    embedding: number[] | null;
    id: string;
    userId: string;
};

interface SaveBookmarkInput {
    preview: PreviewData | null;
    tagNames?: string[];
    url: URL;
    userId: string;
    xPost: XPostThumbnail | null;
}

const saveBookmark = async ({
    preview,
    tagNames = [],
    url,
    userId,
    xPost
}: SaveBookmarkInput): Promise<SavedBookmark | null> => {
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
    } as const satisfies Omit<BookmarkInsert, "embedding" | "id" | "userId">;

    // Embedding failures must not cost the user the bookmark itself: a NULL embedding still saves,
    // and the row keeps working through keyword search.
    const embedding = await embed(embeddingInput({ ...bookmark, tags: tagNames }), userId);

    const saved = await db.transaction(async (tx) => {
        const [row] = await tx
            .insert(bookmarks)
            .values({ ...bookmark, embedding, id, userId })
            .onConflictDoNothing({ target: [bookmarks.userId, bookmarks.url] })
            .returning(bookmarkListItemColumns);

        if (!row) {
            return null;
        }

        const names = await attachTags(tx, {
            bookmarkId: row.id,
            names: tagNames,
            userId
        });

        return {
            names,
            row
        };
    });

    return saved ? toSavedBookmark(saved.row, saved.names) : null;
};

const setBookmarkArchived = async (
    id: string,
    archivedAt: Date | null,
    userId: string
): Promise<SavedBookmark | null> => {
    const [row] = await db
        .update(bookmarks)
        .set({ archivedAt })
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
        .returning(bookmarkListItemColumns);

    if (!row) {
        return null;
    }

    const namesByBookmark = await getBookmarkTags([row.id], userId);

    return toSavedBookmark(row, namesByBookmark.get(row.id) ?? []);
};

// Deletes the row first, then unlinks the locally stored thumbnail if there was one:
// a failed unlink only leaves an unreachable orphan file behind.
const deleteBookmark = async (id: string, userId: string): Promise<boolean> => {
    const [row] = await db
        .delete(bookmarks)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
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
