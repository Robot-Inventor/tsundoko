import { type TagSummary, tagNameKey } from "../lib/tags";
import { and, eq, sql } from "drizzle-orm";
import { bookmarkTags, bookmarks, tags } from "./schema";
import { db } from "./index";

// Tags with no remaining bookmark are hidden: they cannot be created or edited on their own yet.
const listTags = async (userId: string): Promise<TagSummary[]> => {
    const rows = await db
        .select({
            color: tags.color,
            count: sql<number>`count(*)::int`,
            id: tags.id,
            name: tags.name
        })
        .from(tags)
        .innerJoin(bookmarkTags, eq(bookmarkTags.tagId, tags.id))
        .innerJoin(bookmarks, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .where(eq(tags.userId, userId))
        .groupBy(tags.id, tags.name, tags.color);

    return rows.map(({ color, count, id, name }) => ({ color, count, id, name }));
};

interface TagUpdate {
    color: string | null;
    id: string;
    name: string;
    userId: string;
}

// Renaming onto a name another tag already owns merges the two: the bookmarks move to the
// existing tag, which keeps its spelling and color, and the edited tag disappears.
const updateTag = async ({ color, id, name, userId }: TagUpdate): Promise<boolean> =>
    db.transaction(async (tx) => {
        const [source] = await tx
            .select({ id: tags.id })
            .from(tags)
            .where(and(eq(tags.id, id), eq(tags.userId, userId)));

        if (!source) {
            return false;
        }

        const normalizedName = tagNameKey(name);
        const [target] = await tx
            .select({ id: tags.id })
            .from(tags)
            .where(and(eq(tags.userId, userId), eq(tags.normalizedName, normalizedName)));

        if (target && target.id !== id) {
            const links = await tx
                .select({ bookmarkId: bookmarkTags.bookmarkId })
                .from(bookmarkTags)
                .where(eq(bookmarkTags.tagId, id));

            if (links.length) {
                await tx
                    .insert(bookmarkTags)
                    .values(links.map(({ bookmarkId }) => ({ bookmarkId, tagId: target.id })))
                    .onConflictDoNothing();
            }

            await tx.delete(tags).where(eq(tags.id, id));

            return true;
        }

        await tx.update(tags).set({ color, name, normalizedName }).where(eq(tags.id, id));

        return true;
    });

// bookmark_tags rows go with the tag through their foreign key.
const deleteTag = async (id: string, userId: string): Promise<boolean> => {
    const [deleted] = await db
        .delete(tags)
        .where(and(eq(tags.id, id), eq(tags.userId, userId)))
        .returning({ id: tags.id });

    return Boolean(deleted);
};

export { deleteTag, listTags, updateTag };
