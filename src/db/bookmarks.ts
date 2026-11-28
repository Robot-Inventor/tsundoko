// oxlint-disable import/max-dependencies -- Storage, search, tags, and previews legitimately meet here.
import type { BookmarkListFilter, BookmarkPreview, SavedBookmark } from "../lib/bookmark";
import { type SQL, and, asc, cosineDistance, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { type SortBy, defaultSortBy } from "../lib/bookmarkSort";
import { attachTags, getBookmarkTags, tagFilterCondition, textSearchCondition } from "./bookmarkTags";
import { deleteFavicon, deleteThumbnail } from "../lib/imageCache";
import { embed, embeddingInput } from "../lib/embedding";
import type { PreviewData } from "../lib/preview";
import type { XPostThumbnail } from "../lib/xPost";
import { bookmarks } from "./schema";
import { db } from "./index";
import { normalizeBookmarkUrl } from "../lib/normalizeBookmarkUrl";

type BookmarkRow = typeof bookmarks.$inferSelect;

// Client-facing columns: `content` stays search-only and `archivedAt` never leaves the server.
const bookmarkListItemColumns = {
    addedAt: bookmarks.addedAt,
    description: bookmarks.description,
    faviconUrl: bookmarks.faviconUrl,
    id: bookmarks.id,
    publishedAt: bookmarks.publishedAt,
    siteName: bookmarks.siteName,
    thumbnailFit: bookmarks.thumbnailFit,
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
    publishedAt: row.publishedAt?.toISOString() ?? null,
    siteName: row.siteName,
    tags: tagNames,
    thumbnailFit: row.thumbnailFit,
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

// A hostname followed by the path, port, query, fragment, or nothing. The boundary keeps
// `example.com` from matching `example.com.evil.com`.
const hostnamePattern = (hostname: string): string =>
    `^https?://${hostname.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")}([/:?#]|$)`;

// Semantic results are appended below the keyword matches; this bounds how far the list grows
// when a query matches none of the stored text but is still near everything in the embedding space.
const vectorResultLimit = 20;

// A saved sort option applies to the plain list only. Search results keep their relevance order.
// Japanese titles need ICU collation; the addedAt/id tail keeps equal titles in a stable order.
// An undated row counts as the oldest date: first ascending, last descending.
const keywordOrderBy = (sortBy: SortBy): SQL[] => {
    const title = sql`${bookmarks.title} collate "ja-x-icu"`;

    switch (sortBy) {
        case "newest":
            return [desc(bookmarks.addedAt), desc(bookmarks.id)];
        case "oldest":
            return [asc(bookmarks.addedAt), asc(bookmarks.id)];
        case "publishedNewest":
            return [sql`${bookmarks.publishedAt} desc nulls last`, desc(bookmarks.addedAt), desc(bookmarks.id)];
        case "publishedOldest":
            return [sql`${bookmarks.publishedAt} asc nulls first`, desc(bookmarks.addedAt), desc(bookmarks.id)];
        case "titleAsc":
            return [sql`${title} asc`, asc(bookmarks.addedAt), desc(bookmarks.id)];
        case "titleDesc":
            return [sql`${title} desc`, asc(bookmarks.addedAt), desc(bookmarks.id)];
        default:
            return [desc(bookmarks.addedAt), desc(bookmarks.id)];
    }
};

interface ListBookmarksFilter extends BookmarkListFilter {
    sortBy?: SortBy;
}

const listBookmarks = async (
    { query, scope, sortBy = defaultSortBy, tag = "" }: ListBookmarksFilter,
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
        .orderBy(...keywordOrderBy(query ? defaultSortBy : sortBy));

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
): Promise<Pick<BookmarkRow, "faviconUrl" | "thumbnailUrl" | "url"> | null> => {
    const [row] = await db
        .select({
            faviconUrl: bookmarks.faviconUrl,
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
    publishedAt: Date | null;
    userId: string;
    thumbnailFit: SavedBookmark["thumbnailFit"];
};

interface SaveBookmarkInput {
    preview: PreviewData | null;
    tagNames?: string[];
    url: URL;
    userId: string;
    xPost: XPostThumbnail | null;
}

const toBookmarkInsert = ({ preview, url, xPost }: Pick<SaveBookmarkInput, "preview" | "url" | "xPost">) =>
    ({
        content: preview?.content ?? null,
        description: preview?.description ?? null,
        faviconUrl: preview?.faviconUrl ?? null,
        publishedAt: preview?.publishedAt ?? null,
        siteName: xPost?.siteName ?? preview?.siteName ?? url.hostname,
        // The card crops a rendered X post from the top; page thumbnails stay centered.
        thumbnailFit: xPost ? "top" : "center",
        thumbnailUrl: preview?.thumbnailUrl ?? null,
        title: xPost?.title ?? preview?.title ?? url.hostname,
        url: normalizeBookmarkUrl(url)
    }) as const satisfies Omit<BookmarkInsert, "embedding" | "id" | "userId">;

const saveBookmark = async ({
    preview,
    tagNames = [],
    url,
    userId,
    xPost
}: SaveBookmarkInput): Promise<SavedBookmark | null> => {
    const id = crypto.randomUUID();
    const bookmark = toBookmarkInsert({ preview, url, xPost });

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

// Deletes the row first, then its cached images. The favicon is shared by every bookmark on the
// host, so it goes only after the last one is gone.
const deleteBookmark = async (id: string, userId: string): Promise<boolean> => {
    const [row] = await db
        .delete(bookmarks)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
        .returning({ url: bookmarks.url });

    if (!row) {
        return false;
    }

    await deleteThumbnail(id);

    const { hostname } = new URL(row.url);
    const [remaining] = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(sql`${bookmarks.url} ~ ${hostnamePattern(hostname)}`)
        // oxlint-disable-next-line no-magic-numbers -- One row is enough to know the site is still in use.
        .limit(1);

    if (!remaining) {
        await deleteFavicon(hostname);
    }

    return true;
};

export {
    bookmarkExists,
    bookmarkListItemColumns,
    deleteBookmark,
    getBookmarkImageUrls,
    listBookmarks,
    saveBookmark,
    setBookmarkArchived,
    toSavedBookmark
};
