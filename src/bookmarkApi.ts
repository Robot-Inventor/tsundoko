// oxlint-disable import/max-dependencies -- The route module legitimately wires validation, storage, and rate limiting.
import { type BookmarkScope, httpStatus } from "./lib/bookmark";
import { type SortBy, parseSortBy } from "./lib/bookmarkSort";
import { bookmarkListRateLimit, bookmarkWriteRateLimit } from "./lib/rateLimits";
import { deleteBookmark, listBookmarks, setBookmarkArchived } from "./db/bookmarks";
import { saveBookmarkFromUrl, saveBookmarkOutcomeStatus } from "./lib/saveBookmarkFlow";
import type { ErrorCode } from "./lib/errorCodes";
import { Hono } from "hono";
import { apiError } from "./lib/apiError";
import { bookmarkUrl } from "./lib/bookmarkUrl";
import { normalizeTagNames } from "./lib/tags";
import { parseContentType } from "./lib/mediaType";
import { requestBodyLimit } from "./lib/requestBodyLimit";
import { type } from "arktype";
import { updateBookmark } from "./db/bookmarkUpdate";
import { validator } from "hono/validator";

// An edited title only needs to be non-empty; pages may legitimately have no title of their own.
const minimumTitleLength = 1;

const previewRequest = type("string.json.parse").to({
    tags: type("string[]").optional(),
    url: bookmarkUrl
});

const archiveRequest = type({
    archivedAt: "string.date.parse | null"
});

const editRequest = type({
    tags: "string[]",
    title: type("string.trim").to(type("string").atLeastLength(minimumTitleLength))
});

const bookmarkId = type("string.uuid");

// oxlint-disable id-length -- "q" is the search parameter name defined by the API.
const listQuery = validator("query", (value): { q: string; scope: BookmarkScope; sortBy: SortBy; tag: string } => {
    // A repeated parameter arrives as an array; treat the first value as the query.
    const q = (Array.isArray(value["q"]) ? value["q"][0] : value["q"])?.trim() ?? "";
    const tag = (Array.isArray(value["tag"]) ? value["tag"][0] : value["tag"])?.trim() ?? "";

    // An unknown scope falls back to the default instead of failing, so stale clients keep working.
    const rawScope = Array.isArray(value["scope"]) ? value["scope"][0] : value["scope"];
    const scope: BookmarkScope = rawScope === "archived" ? "archived" : "active";

    // An invalid sort value falls back to the default, like an unknown scope does.
    const rawSortBy = Array.isArray(value["sortBy"]) ? value["sortBy"][0] : value["sortBy"];

    return {
        q,
        scope,
        sortBy: parseSortBy(rawSortBy),
        tag
    };
});
// oxlint-enable id-length

const bookmarkIdParam = validator("param", (value): { id: string } => {
    const id = value["id"]?.trim() ?? "";

    // An empty id fails the bookmark lookup later and turns into a 404 response.
    return {
        id: bookmarkId(id) instanceof type.errors ? "" : id
    };
});

const archivePayload = validator("json", (value, context) => {
    const parsed = archiveRequest(value);

    if (parsed instanceof type.errors) {
        return context.json(apiError("bookmark.invalidArchivedAt"), httpStatus.badRequest);
    }

    return parsed;
});

const editPayload = validator("json", (value, context) => {
    const parsed = editRequest(value);

    if (parsed instanceof type.errors) {
        return context.json(apiError("bookmark.invalidTitle"), httpStatus.badRequest);
    }

    return parsed;
});

const bookmarkApi = new Hono<{ Variables: { userId: string } }>()
    .get("/api/bookmarks", bookmarkListRateLimit, listQuery, async (context) => {
        context.header("Cache-Control", "no-store");
        const query = context.req.valid("query");

        try {
            return context.json(
                await listBookmarks(
                    {
                        query: query.q,
                        scope: query.scope,
                        sortBy: query.sortBy,
                        tag: query.tag
                    },
                    context.get("userId")
                ),
                httpStatus.ok
            );
        } catch {
            return context.json(apiError("bookmark.loadFailed"), httpStatus.internalServerError);
        }
    })
    .post("/api/bookmarks", bookmarkWriteRateLimit, requestBodyLimit("bookmark.tooLong"), async (context) => {
        context.header("Cache-Control", "no-store");

        if (parseContentType(context.req.header("content-type"))?.essence !== "application/json") {
            return context.json(apiError("bookmark.invalidJson"), httpStatus.unsupportedMediaType);
        }

        const input = previewRequest(await context.req.text());

        if (input instanceof type.errors) {
            return context.json(apiError("bookmark.invalidUrl"), httpStatus.badRequest);
        }

        const tagNames = normalizeTagNames(input.tags ?? []);

        if (!tagNames) {
            return context.json(apiError("tag.invalid"), httpStatus.badRequest);
        }

        const outcome = await saveBookmarkFromUrl({
            tags: tagNames,
            url: input.url.href,
            userId: context.get("userId")
        });

        if (outcome.status === "created") {
            return context.json(outcome.bookmark, httpStatus.created);
        }

        const errorByOutcome = {
            duplicate: "bookmark.duplicate",
            fetchFailed: "bookmark.fetchFailed",
            invalidUrl: "bookmark.invalidUrl",
            saveFailed: "bookmark.saveFailed"
        } as const satisfies Record<typeof outcome.status, ErrorCode>;

        return context.json(apiError(errorByOutcome[outcome.status]), saveBookmarkOutcomeStatus[outcome.status]);
    })
    .patch(
        "/api/bookmarks/:id",
        bookmarkWriteRateLimit,
        requestBodyLimit("bookmark.tooLong"),
        bookmarkIdParam,
        archivePayload,
        async (context) => {
            context.header("Cache-Control", "no-store");
            const { id } = context.req.valid("param");
            const { archivedAt } = context.req.valid("json");

            try {
                const updated = await setBookmarkArchived(id, archivedAt, context.get("userId"));

                return updated
                    ? context.json(updated, httpStatus.ok)
                    : context.json(apiError("bookmark.notFound"), httpStatus.notFound);
            } catch {
                return context.json(apiError("bookmark.saveFailed"), httpStatus.internalServerError);
            }
        }
    )
    .put(
        "/api/bookmarks/:id",
        bookmarkWriteRateLimit,
        requestBodyLimit("bookmark.tooLong"),
        bookmarkIdParam,
        editPayload,
        async (context) => {
            context.header("Cache-Control", "no-store");
            const { id } = context.req.valid("param");
            const { tags, title } = context.req.valid("json");
            const tagNames = normalizeTagNames(tags);

            if (!tagNames) {
                return context.json(apiError("tag.invalid"), httpStatus.badRequest);
            }

            try {
                const updated = await updateBookmark({ id, tags: tagNames, title, userId: context.get("userId") });

                return updated
                    ? context.json(updated, httpStatus.ok)
                    : context.json(apiError("bookmark.notFound"), httpStatus.notFound);
            } catch {
                return context.json(apiError("bookmark.saveFailed"), httpStatus.internalServerError);
            }
        }
    )
    .delete("/api/bookmarks/:id", bookmarkWriteRateLimit, bookmarkIdParam, async (context) => {
        context.header("Cache-Control", "no-store");
        const { id } = context.req.valid("param");

        try {
            const deleted = await deleteBookmark(id, context.get("userId"));

            return deleted
                ? context.body(null, httpStatus.noContent)
                : context.json(apiError("bookmark.notFound"), httpStatus.notFound);
        } catch {
            return context.json(apiError("bookmark.saveFailed"), httpStatus.internalServerError);
        }
    });

type BookmarkApi = typeof bookmarkApi;

export { type BookmarkApi, bookmarkApi };
