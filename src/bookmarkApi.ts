// oxlint-disable import/max-dependencies -- The route module legitimately wires validation, storage, previews, and rate limiting.
import { type BookmarkScope, httpStatus } from "./lib/bookmark";
import { type PreviewData, getPreview } from "./lib/preview";
import { type SortBy, parseSortBy } from "./lib/bookmarkSort";
import { type XPostThumbnail, isXPostUrl, renderXPost } from "./lib/xPost";
import { bookmarkExists, deleteBookmark, listBookmarks, saveBookmark, setBookmarkArchived } from "./db/bookmarks";
import { cacheRemoteFavicon, cacheRemoteThumbnail, cacheRenderedThumbnail, readFavicon } from "./lib/imageCache";
import { runImageOutbound, runOutbound } from "./lib/outboundLimit";
import { Hono } from "hono";
import { apiError } from "./lib/apiError";
import { bookmarkUrl } from "./lib/bookmarkUrl";
import { createRateLimit } from "./lib/rateLimit";
import { normalizeBookmarkUrl } from "./lib/normalizeBookmarkUrl";
import { normalizeTagNames } from "./lib/tags";
import { parseContentType } from "./lib/mediaType";
import { requestBodyLimit } from "./lib/requestBodyLimit";
import { type } from "arktype";
import { validator } from "hono/validator";

const bookmarkSaveLimit = 30;
const bookmarkListLimit = 60;

const bookmarkSaveRateLimit = createRateLimit({ limit: bookmarkSaveLimit });
const bookmarkListRateLimit = createRateLimit({ limit: bookmarkListLimit });

const previewRequest = type("string.json.parse").to({
    tags: type("string[]").optional(),
    url: bookmarkUrl
});

const archiveRequest = type({
    archivedAt: "string.date.parse | null"
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

interface BookmarkImageSources {
    faviconUrl: string | null;
    hostname: string;
    id: string;
    thumbnailUrl: string | null;
}

// Both fetches are best-effort: a failure leaves that image for the request path to fill, so the
// bookmark itself is still saved and returned.
const warmImageCache = async (
    userId: string,
    sources: BookmarkImageSources,
    xPostPng: Uint8Array | null
): Promise<void> => {
    // The favicon is shared by every bookmark on the host, so an already cached icon is kept
    // instead of rewriting it with whatever this page happens to advertise.
    const cachedFavicon = await readFavicon(sources.hostname);

    await Promise.all([
        runImageOutbound(userId, () => {
            if (xPostPng) {
                return cacheRenderedThumbnail(sources.id, xPostPng);
            }

            return sources.thumbnailUrl
                ? cacheRemoteThumbnail(sources.id, sources.thumbnailUrl)
                : Promise.resolve(null);
        }).catch(() => null),
        cachedFavicon
            ? Promise.resolve(null)
            : runImageOutbound(userId, () => cacheRemoteFavicon(sources.hostname, sources.faviconUrl)).catch(() => null)
    ]);
};

interface FetchedPreview {
    preview: PreviewData | null;
    xPost: XPostThumbnail | null;
}

// X post pages are fetched by xeet instead of the OG pipeline, so both are tried independently:
// either one succeeding is enough to save the bookmark, and the OG result fills the rest.
const fetchPreview = async (userId: string, url: URL): Promise<FetchedPreview> => {
    const [xPost, preview] = await Promise.all([
        isXPostUrl(url)
            ? runOutbound(userId, () => renderXPost(url)).catch((error: unknown) => {
                  // A busy pool and a failed render both degrade to the OG result.
                  // oxlint-disable-next-line no-console -- Server-side diagnostics are console's legitimate use.
                  console.warn("X post thumbnail rendering failed:", error);

                  return null;
              })
            : null,
        runOutbound(userId, () => getPreview(url)).catch(() => null)
    ]);

    return {
        preview,
        xPost
    };
};

const archivePayload = validator("json", (value, context) => {
    const parsed = archiveRequest(value);

    if (parsed instanceof type.errors) {
        return context.json(apiError("bookmark.invalidArchivedAt"), httpStatus.badRequest);
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
    .post("/api/bookmarks", bookmarkSaveRateLimit, requestBodyLimit("bookmark.tooLong"), async (context) => {
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

        try {
            if (await bookmarkExists(normalizeBookmarkUrl(input.url), context.get("userId"))) {
                return context.json(apiError("bookmark.duplicate"), httpStatus.conflict);
            }
        } catch {
            return context.json(apiError("bookmark.saveFailed"), httpStatus.internalServerError);
        }

        const { preview, xPost } = await fetchPreview(context.get("userId"), input.url);

        if (!preview && !xPost) {
            return context.json(apiError("bookmark.fetchFailed"), httpStatus.badGateway);
        }

        try {
            const saved = await saveBookmark({
                preview,
                tagNames,
                url: input.url,
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
