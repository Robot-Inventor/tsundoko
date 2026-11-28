// oxlint-disable import/max-dependencies -- The route module legitimately wires validation, storage, and rate limiting.
import { type BookmarkScope, httpStatus } from "./lib/bookmark";
import { type SortBy, parseSortBy } from "./lib/bookmarkSort";
import { bookmarkExists, deleteBookmark, listBookmarks, saveBookmark, setBookmarkArchived } from "./db/bookmarks";
import { bookmarkUrl, normalizeBookmarkUrl } from "./lib/bookmarkUrl";
import { fetchPreview, warmImageCache } from "./lib/bookmarkPreview";
import { Hono } from "hono";
import { apiError } from "./lib/apiError";
import { createRateLimit } from "./lib/rateLimit";
import { normalizeTagNames } from "./lib/tags";
import { parseContentType } from "./lib/mediaType";
import { requestBodyLimit } from "./lib/requestBodyLimit";
import { type } from "arktype";
import { updateBookmark } from "./db/bookmarkUpdate";
import { validator } from "hono/validator";

const bookmarkSaveLimit = 30;
const bookmarkListLimit = 60;
// An edited title only needs to be non-empty; pages may legitimately have no title of their own.
const minimumTitleLength = 1;

// Saving and editing both may call the embedding API, so they share one budget.
const bookmarkWriteRateLimit = createRateLimit({ limit: bookmarkSaveLimit });
const bookmarkListRateLimit = createRateLimit({ limit: bookmarkListLimit });

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

// A failed lookup is reported as null so the route can distinguish it from "not a duplicate".
const bookmarkAlreadyExists = async (url: URL, userId: string): Promise<boolean | null> => {
    try {
        return await bookmarkExists(url.href, userId);
    } catch {
        return null;
    }
};

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
    // oxlint-disable-next-line max-statements -- The save pipeline is linear; splitting it further would erase Hono's typed response.
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

        const submittedUrl = new URL(normalizeBookmarkUrl(input.url));
        const alreadySubmitted = await bookmarkAlreadyExists(submittedUrl, context.get("userId"));

        if (alreadySubmitted === null) {
            return context.json(apiError("bookmark.saveFailed"), httpStatus.internalServerError);
        }

        if (alreadySubmitted) {
            return context.json(apiError("bookmark.duplicate"), httpStatus.conflict);
        }

        const { preview, url: resolvedUrl, xPost } = await fetchPreview(context.get("userId"), input.url);

        if (!preview && !xPost) {
            return context.json(apiError("bookmark.fetchFailed"), httpStatus.badGateway);
        }

        const normalizedUrl = new URL(normalizeBookmarkUrl(resolvedUrl));

        try {
            const saved = await saveBookmark({
                preview,
                tagNames,
                url: normalizedUrl,
                userId: context.get("userId"),
                xPost
            });

            if (!saved) {
                return context.json(apiError("bookmark.duplicate"), httpStatus.conflict);
            }

            // Warming the cache before the response makes the first card render local.
            await warmImageCache(
                context.get("userId"),
                {
                    faviconUrl: preview?.faviconUrl ?? null,
                    hostname: new URL(saved.url).hostname,
                    id: saved.id,
                    thumbnailUrl: preview?.thumbnailUrl ?? null
                },
                xPost?.png ?? null
            );

            return context.json(saved, httpStatus.created);
        } catch {
            return context.json(apiError("bookmark.saveFailed"), httpStatus.internalServerError);
        }
    })
    .patch(
        "/api/bookmarks/:id",
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
    .delete("/api/bookmarks/:id", bookmarkIdParam, async (context) => {
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
