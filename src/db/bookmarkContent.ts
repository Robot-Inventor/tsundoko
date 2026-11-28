import { and, eq } from "drizzle-orm";
import { bookmarkListItemColumns, toSavedBookmark } from "./bookmarks";
import type { SavedBookmark } from "../lib/bookmark";
import { bookmarks } from "./schema";
import { db } from "./index";
import { getBookmarkTags } from "./bookmarkTags";

// Editing only needs the title and tags, so it must not pull a potentially large article body.
const getBookmarkMetadata = async (id: string, userId: string): Promise<SavedBookmark | null> => {
    const [row] = await db
        .select(bookmarkListItemColumns)
        .from(bookmarks)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

    if (!row) {
        return null;
    }

    const tagsByBookmark = await getBookmarkTags([row.id], userId);

    return toSavedBookmark(row, tagsByBookmark.get(row.id) ?? []);
};

// The MCP get_bookmark tool is the only caller: the REST API deliberately keeps the extracted
// article body on the server, so this read is separate from the list path.
const getBookmarkWithContent = async (
    id: string,
    userId: string
): Promise<(SavedBookmark & { content: string | null }) | null> => {
    const [row] = await db
        .select({
            ...bookmarkListItemColumns,
            content: bookmarks.content
        })
        .from(bookmarks)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

    if (!row) {
        return null;
    }

    const tagsByBookmark = await getBookmarkTags([row.id], userId);

    return {
        ...toSavedBookmark(row, tagsByBookmark.get(row.id) ?? []),
        content: row.content
    };
};

export { getBookmarkMetadata, getBookmarkWithContent };
