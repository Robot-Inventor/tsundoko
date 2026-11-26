import { type SQL, and, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { bookmarkTags, bookmarks, tags } from "./schema";
import { tagNameKey, trimTagName } from "../lib/tags";
import { db } from "./index";

// The transaction client and the plain database expose the same insert/select surface here.
type TagClient = Pick<typeof db, "insert" | "select">;

interface AttachTagsInput {
    bookmarkId: string;
    names: string[];
    userId: string;
}

// Inserts run inside the bookmark's transaction; an existing tag keeps the spelling it was first
// saved with, and its id is reused instead of creating a second row for another spelling.
const attachTags = async (client: TagClient, { bookmarkId, names, userId }: AttachTagsInput): Promise<string[]> => {
    if (!names.length) {
        return [];
    }

    const trimmed = names.map(trimTagName);
    // A repeated key would insert the same join row twice and break its primary key.
    const keys = Array.from(new Set(trimmed.map(tagNameKey)));

    await client
        .insert(tags)
        .values(
            trimmed.map((name) => ({
                name,
                normalizedName: tagNameKey(name),
                userId
            }))
        )
        .onConflictDoNothing({ target: [tags.userId, tags.normalizedName] });

    const created = await client
        .select({
            id: tags.id,
            name: tags.name,
            normalizedName: tags.normalizedName
        })
        .from(tags)
        .where(and(eq(tags.userId, userId), inArray(tags.normalizedName, keys)));

    const byKey = new Map(created.map((tag) => [tag.normalizedName, tag]));
    const values = keys.flatMap((key) => {
        const tag = byKey.get(key);

        return tag
            ? [
                  {
                      bookmarkId,
                      tagId: tag.id
                  }
              ]
            : [];
    });

    if (values.length) {
        await client.insert(bookmarkTags).values(values);
    }

    // Return the names actually stored, in the order the user entered them.
    return keys.flatMap((key) => byKey.get(key)?.name ?? []);
};

const getBookmarkTags = async (ids: string[], userId: string): Promise<Map<string, string[]>> => {
    if (!ids.length) {
        return new Map();
    }

    const rows = await db
        .select({ bookmarkId: bookmarkTags.bookmarkId, name: tags.name })
        .from(bookmarkTags)
        .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
        .where(and(eq(tags.userId, userId), inArray(bookmarkTags.bookmarkId, ids)))
        .orderBy(tags.name);

    const byBookmark = new Map<string, string[]>();

    for (const row of rows) {
        const names = byBookmark.get(row.bookmarkId) ?? [];
        names.push(row.name);
        byBookmark.set(row.bookmarkId, names);
    }

    return byBookmark;
};

// Correlated subqueries keep the bookmark row set flat; a join would need de-duplication once a
// bookmark has several matching tags.
const tagFilterCondition = (tag: string, userId: string): SQL | undefined => {
    const key = tagNameKey(tag);

    if (!key) {
        return sql`true`;
    }

    return exists(
        db
            .select({ bookmarkId: bookmarkTags.bookmarkId })
            .from(bookmarkTags)
            .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
            .where(
                and(eq(bookmarkTags.bookmarkId, bookmarks.id), eq(tags.userId, userId), eq(tags.normalizedName, key))
            )
    );
};

const textSearchCondition = (pattern: string | null, userId: string): SQL | undefined => {
    if (!pattern) {
        return sql`true`;
    }

    return or(
        ilike(bookmarks.title, pattern),
        ilike(bookmarks.description, pattern),
        ilike(bookmarks.content, pattern),
        ilike(bookmarks.siteName, pattern),
        ilike(bookmarks.url, pattern),
        exists(
            db
                .select({ bookmarkId: bookmarkTags.bookmarkId })
                .from(bookmarkTags)
                .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
                .where(
                    and(eq(bookmarkTags.bookmarkId, bookmarks.id), eq(tags.userId, userId), ilike(tags.name, pattern))
                )
        )
    );
};

export { attachTags, getBookmarkTags, tagFilterCondition, textSearchCondition };
