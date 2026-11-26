import { bookmarkTags, bookmarks, tags } from "./schema";
import { eq, sql } from "drizzle-orm";
import type { TagSummary } from "../lib/tags";
import { db } from "./index";

// Tags with no remaining bookmark are hidden: they cannot be created or edited on their own yet.
const listTags = async (userId: string): Promise<TagSummary[]> => {
    const rows = await db
        .select({ count: sql<number>`count(*)::int`, name: tags.name })
        .from(tags)
        .innerJoin(bookmarkTags, eq(bookmarkTags.tagId, tags.id))
        .innerJoin(bookmarks, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .where(eq(tags.userId, userId))
        .groupBy(tags.id, tags.name);

    return rows.map(({ count, name }) => ({ count, name }));
};

export { listTags };
