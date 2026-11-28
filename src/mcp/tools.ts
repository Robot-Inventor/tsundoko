import { bookmarkListLimiter, bookmarkWriteLimiter, tagListLimiter, tagWriteLimiter } from "../lib/rateLimits";
import { deleteBookmark, listBookmarks, setBookmarkArchived } from "../db/bookmarks";
import { getBookmarkMetadata, getBookmarkWithContent } from "../db/bookmarkContent";
import { isValidTagColor, normalizeTagNames } from "../lib/tags";
import { listTags, updateTag } from "../db/tags";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { RateLimitResult } from "../lib/rateLimit";
import { saveBookmarkFromUrl } from "../lib/saveBookmarkFlow";
import { type } from "arktype";
import { updateBookmark } from "../db/bookmarkUpdate";

const defaultSearchLimit = 20;
const maxSearchLimit = 50;
const minimumSearchLimit = 1;
const minimumOffset = 0;
const minimumTitleLength = 1;
const contentCharacterLimit = 100_000;

const searchInput = type({
    "limit?": type("number.integer").atLeast(minimumSearchLimit).atMost(maxSearchLimit),
    "offset?": type("number.integer").atLeast(minimumOffset),
    "query?": "string",
    "scope?": '"active" | "archived"',
    "tag?": "string"
});

const bookmarkIdInput = type({ id: "string.uuid" });

const addBookmarkInput = type({
    "tags?": "string[]",
    url: "string"
});

const updateBookmarkInput = type({
    id: "string.uuid",
    "tags?": "string[]",
    "title?": type("string.trim").to(type("string").atLeastLength(minimumTitleLength))
});

const archiveBookmarkInput = type({
    archived: "boolean",
    id: "string.uuid"
});

const updateTagInput = type({
    color: "string | null",
    id: "string.uuid",
    name: "string"
});

const textResult = (value: unknown): CallToolResult => ({
    content: [
        {
            text: JSON.stringify(value),
            type: "text"
        }
    ]
});

const errorResult = (message: string): CallToolResult => ({
    content: [
        {
            text: message,
            type: "text"
        }
    ],
    isError: true
});

const rateLimitFailure = async (
    limiter: (key: string) => Promise<RateLimitResult>,
    userId: string
): Promise<CallToolResult | null> => {
    const result = await limiter(userId);

    return result.allowed
        ? null
        : errorResult(`Rate limit exceeded. Retry after ${String(result.retryAfterSeconds)} seconds.`);
};

const searchBookmarks = async (userId: string, input: typeof searchInput.infer): Promise<CallToolResult> => {
    const limited = await rateLimitFailure(bookmarkListLimiter, userId);

    if (limited) {
        return limited;
    }

    const bookmarks = await listBookmarks(
        {
            query: input.query?.trim() ?? "",
            scope: input.scope ?? "active",
            tag: input.tag?.trim() ?? ""
        },
        userId
    );

    const offset = input.offset ?? minimumOffset;
    const limit = input.limit ?? defaultSearchLimit;

    return textResult(bookmarks.slice(offset, offset + limit));
};

const getBookmark = async (userId: string, id: string): Promise<CallToolResult> => {
    const limited = await rateLimitFailure(bookmarkListLimiter, userId);

    if (limited) {
        return limited;
    }

    const bookmark = await getBookmarkWithContent(id, userId);

    if (!bookmark) {
        return errorResult("Bookmark not found.");
    }

    const body = bookmark.content;

    if (body === null || body.length <= contentCharacterLimit) {
        return textResult(bookmark);
    }

    const notice = `\n\n[Content truncated at ${String(contentCharacterLimit)} characters.]`;
    // Reserve the notice so the returned body stays within the advertised limit.
    // oxlint-disable-next-line no-magic-numbers -- Zero is the start of the body.
    const truncated = body.slice(0, contentCharacterLimit - notice.length);

    return textResult({ ...bookmark, content: `${truncated}${notice}` });
};

const listTagsForTool = async (userId: string): Promise<CallToolResult> => {
    const limited = await rateLimitFailure(tagListLimiter, userId);

    return limited ?? textResult(await listTags(userId));
};

const editTag = async (userId: string, input: typeof updateTagInput.infer): Promise<CallToolResult> => {
    const limited = await rateLimitFailure(tagWriteLimiter, userId);

    if (limited) {
        return limited;
    }

    const [name] = normalizeTagNames([input.name]) ?? [];
    const color = input.color?.toLowerCase() ?? null;

    if (!name) {
        return errorResult("Invalid tag name.");
    }

    if (!isValidTagColor(color)) {
        return errorResult("Invalid color. Use a hex value like #12a594, or null to clear it.");
    }

    const updated = await updateTag({ color, id: input.id, name, userId });

    return updated ? textResult(updated) : errorResult("Tag not found.");
};

const addBookmark = async (userId: string, input: typeof addBookmarkInput.infer): Promise<CallToolResult> => {
    const limited = await rateLimitFailure(bookmarkWriteLimiter, userId);

    if (limited) {
        return limited;
    }

    const tags = normalizeTagNames(input.tags ?? []);

    if (!tags) {
        return errorResult("Invalid tags. Use at most 10 tags of 30 characters or fewer.");
    }

    const outcome = await saveBookmarkFromUrl({ tags, url: input.url, userId });

    // oxlint-disable-next-line default-case -- The status union is exhaustive.
    switch (outcome.status) {
        case "created":
            return textResult(outcome.bookmark);
        case "duplicate":
            return errorResult("That URL is already saved.");
        case "invalidUrl":
            return errorResult("Enter an http:// or https:// URL.");
        case "fetchFailed":
            return errorResult("Could not fetch page details for that URL.");
        case "saveFailed":
            return errorResult("Could not save the bookmark.");
    }
};

const editBookmark = async (userId: string, input: typeof updateBookmarkInput.infer): Promise<CallToolResult> => {
    if (!("title" in input) && !("tags" in input)) {
        return errorResult("Provide a title or tags to update.");
    }

    const limited = await rateLimitFailure(bookmarkWriteLimiter, userId);

    if (limited) {
        return limited;
    }

    const existing = await getBookmarkMetadata(input.id, userId);

    if (!existing) {
        return errorResult("Bookmark not found.");
    }

    const providedTags = input.tags ?? null;
    const tags = providedTags === null ? existing.tags : normalizeTagNames(providedTags);

    if (!tags) {
        return errorResult("Invalid tags. Use at most 10 tags of 30 characters or fewer.");
    }

    const updated = await updateBookmark({
        id: input.id,
        tags,
        title: input.title ?? existing.title,
        userId
    });

    return updated ? textResult(updated) : errorResult("Bookmark not found.");
};

const setArchived = async (userId: string, id: string, archived: boolean): Promise<CallToolResult> => {
    const limited = await rateLimitFailure(bookmarkWriteLimiter, userId);

    if (limited) {
        return limited;
    }

    const updated = await setBookmarkArchived(id, archived ? new Date() : null, userId);

    return updated ? textResult(updated) : errorResult("Bookmark not found.");
};

const removeBookmark = async (userId: string, id: string): Promise<CallToolResult> => {
    const limited = await rateLimitFailure(bookmarkWriteLimiter, userId);

    if (limited) {
        return limited;
    }

    const deleted = await deleteBookmark(id, userId);

    return deleted ? textResult({ deleted: true, id }) : errorResult("Bookmark not found.");
};

export {
    addBookmark,
    addBookmarkInput,
    archiveBookmarkInput,
    bookmarkIdInput,
    editBookmark,
    editTag,
    getBookmark,
    listTagsForTool,
    removeBookmark,
    searchBookmarks,
    searchInput,
    setArchived,
    updateBookmarkInput,
    updateTagInput
};
