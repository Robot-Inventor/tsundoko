import { type BookmarkScope, bookmarkMessages } from "./lib/bookmark";
import { bookmarkExists, deleteBookmark, listBookmarks, saveBookmark, setBookmarkArchived } from "./db/bookmarks";
import { bookmarkUrl, invalidBookmarkUrlMessage, normalizeBookmarkUrl } from "./lib/bookmarkUrl";
import { isXPostUrl, renderXPost } from "./lib/xPost";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getPreview } from "./lib/preview";
import { parseContentType } from "./lib/mediaType";
import { type } from "arktype";
import { validator } from "hono/validator";

const maxRequestBytes = 16_384;

const httpStatus = {
    badGateway: 502,
    badRequest: 400,
    conflict: 409,
    created: 201,
    internalServerError: 500,
    noContent: 204,
    notFound: 404,
    ok: 200,
    payloadTooLarge: 413,
    unsupportedMediaType: 415
} as const;

const previewRequest = type("string.json.parse").to({
    url: bookmarkUrl
});

const archiveRequest = type("string.json.parse").to({
    archivedAt: "string.date.parse | null"
});

const bookmarkId = type("string.uuid");

// oxlint-disable id-length -- "q" is the search parameter name defined by the API.
const listQuery = validator("query", (value): { q: string; scope: BookmarkScope } => {
    // A repeated parameter arrives as an array; treat the first value as the query.
    const q = (Array.isArray(value["q"]) ? value["q"][0] : value["q"])?.trim() ?? "";

    // An unknown scope falls back to the default instead of failing, so stale clients keep working.
    const rawScope = Array.isArray(value["scope"]) ? value["scope"][0] : value["scope"];
    const scope: BookmarkScope = rawScope === "archived" ? "archived" : "active";

    return {
        q,
        scope
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
        return context.json({ error: bookmarkMessages.invalidArchivedAt }, httpStatus.badRequest);
    }

    return parsed;
});

const bookmarkApi = new Hono()
    .get("/api/bookmarks", listQuery, async (context) => {
        context.header("Cache-Control", "no-store");
        const query = context.req.valid("query");

        try {
            return context.json(await listBookmarks(query.q, query.scope), httpStatus.ok);
        } catch {
            return context.json({ error: bookmarkMessages.loadFailed }, httpStatus.internalServerError);
        }
    })
    .post(
        "/api/bookmarks",
        bodyLimit({
            maxSize: maxRequestBytes,
            onError: (context) => context.json({ error: "入力が長すぎます。" }, httpStatus.payloadTooLarge)
        }),
        async (context) => {
            context.header("Cache-Control", "no-store");

            if (parseContentType(context.req.header("content-type"))?.essence !== "application/json") {
                return context.json({ error: "JSONでURLを送信してください。" }, httpStatus.unsupportedMediaType);
            }

            const input = previewRequest(await context.req.text());

            if (input instanceof type.errors) {
                return context.json({ error: invalidBookmarkUrlMessage }, httpStatus.badRequest);
            }

            try {
                if (await bookmarkExists(normalizeBookmarkUrl(input.url))) {
                    return context.json({ error: bookmarkMessages.duplicate }, httpStatus.conflict);
                }
            } catch {
                return context.json({ error: bookmarkMessages.saveFailed }, httpStatus.internalServerError);
            }

            // X post pages are fetched by xeet instead of the OG pipeline, so both are tried independently:
            // either one succeeding is enough to save the bookmark, and the OG result fills the rest.
            const [xPost, preview] = await Promise.all([
                isXPostUrl(input.url)
                    ? renderXPost(input.url).catch((error: unknown) => {
                          // The OG fallback keeps this non-fatal, but the signal matters for diagnosis.
                          // oxlint-disable-next-line no-console -- Server-side diagnostics are console's legitimate use.
                          console.warn("X post thumbnail rendering failed:", error);

                          return null;
                      })
                    : null,
                getPreview(input.url).catch(() => null)
            ]);

            if (!preview && !xPost) {
                return context.json({ error: bookmarkMessages.fetchFailed }, httpStatus.badGateway);
            }

            try {
                const saved = await saveBookmark(input.url, xPost, preview);

                return saved
                    ? context.json(saved, httpStatus.created)
                    : context.json({ error: bookmarkMessages.duplicate }, httpStatus.conflict);
            } catch {
                return context.json({ error: bookmarkMessages.saveFailed }, httpStatus.internalServerError);
            }
        }
    )
    .patch(
        "/api/bookmarks/:id",
        bodyLimit({
            maxSize: maxRequestBytes,
            onError: (context) => context.json({ error: "入力が長すぎます。" }, httpStatus.payloadTooLarge)
        }),
        bookmarkIdParam,
        archivePayload,
        async (context) => {
            context.header("Cache-Control", "no-store");
            const { id } = context.req.valid("param");
            const { archivedAt } = context.req.valid("json");

            try {
                const updated = await setBookmarkArchived(id, archivedAt);

                return updated
                    ? context.json(updated, httpStatus.ok)
                    : context.json({ error: bookmarkMessages.notFound }, httpStatus.notFound);
            } catch {
                return context.json({ error: bookmarkMessages.saveFailed }, httpStatus.internalServerError);
            }
        }
    )
    .delete("/api/bookmarks/:id", bookmarkIdParam, async (context) => {
        context.header("Cache-Control", "no-store");
        const { id } = context.req.valid("param");

        try {
            const deleted = await deleteBookmark(id);

            return deleted
                ? context.body(null, httpStatus.noContent)
                : context.json({ error: bookmarkMessages.notFound }, httpStatus.notFound);
        } catch {
            return context.json({ error: bookmarkMessages.saveFailed }, httpStatus.internalServerError);
        }
    });

type BookmarkApi = typeof bookmarkApi;

export { type BookmarkApi, bookmarkApi };
