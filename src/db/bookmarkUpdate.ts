import { and, eq } from "drizzle-orm";
import { attachTags, getBookmarkTags } from "./bookmarkTags";
import { bookmarkListItemColumns, toSavedBookmark } from "./bookmarks";
import { bookmarkTags, bookmarks } from "./schema";
import { embed, embeddingInput } from "../lib/embedding";
import type { SavedBookmark } from "../lib/bookmark";
import { db } from "./index";
import { tagNameKey } from "../lib/tags";

interface UpdateBookmarkInput {
    id: string;
    tags: string[];
    title: string;
    userId: string;
}

interface BookmarkChanges {
    embedding?: number[];
    title: string;
}

// Tag spelling is kept from the first save, so only the case-insensitive key decides equality.
const sameTags = (left: string[], right: string[]): boolean => {
    if (left.length !== right.length) {
        return false;
    }

    const keys = new Set(left.map((name) => tagNameKey(name)));

    return right.every((name) => keys.has(tagNameKey(name)));
};

const updateBookmark = async ({ id, tags, title, userId }: UpdateBookmarkInput): Promise<SavedBookmark | null> => {
    const [existing] = await db
        .select({
            ...bookmarkListItemColumns,
            content: bookmarks.content
        })
        .from(bookmarks)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

    if (!existing) {
        return null;
    }

    // Saving an untouched dialog must not spend an embedding request or rewrite the tag links.
    if (existing.title === title) {
        const storedTags = (await getBookmarkTags([id], userId)).get(id) ?? [];

        if (sameTags(storedTags, tags)) {
            return toSavedBookmark(existing, storedTags);
        }
    }

    // Title and tags are part of the search text, so the vector is rebuilt with them. A failed
    // regeneration keeps the stored vector instead of erasing it.
    const embedding = await embed(embeddingInput({ ...existing, tags, title }), userId);

    const updated = await db.transaction(async (tx) => {
        const changes: BookmarkChanges = {
            title
        };

        if (embedding) {
            changes.embedding = embedding;
        }

        const [row] = await tx
            .update(bookmarks)
            .set(changes)
            .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
            .returning(bookmarkListItemColumns);

        if (!row) {
            return null;
        }

        await tx.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, id));

        const names = await attachTags(tx, {
            bookmarkId: id,
            names: tags,
            userId
        });

        return {
            names,
            row
        };
    });

    return updated ? toSavedBookmark(updated.row, updated.names) : null;
};

export { updateBookmark };
