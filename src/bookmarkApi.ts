import { bookmarkExists, listBookmarks, saveBookmark } from "./db/bookmarks";
import { bookmarkUrl, invalidBookmarkUrlMessage, normalizeBookmarkUrl } from "./lib/bookmarkUrl";
import { isXPostUrl, renderXPost } from "./lib/xPost";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { bookmarkMessages } from "./lib/bookmark";
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
    ok: 200,
    payloadTooLarge: 413,
    unsupportedMediaType: 415
} as const;

const previewRequest = type("string.json.parse").to({
    url: bookmarkUrl
});

// oxlint-disable id-length -- "q" is the search parameter name defined by the API.
const searchQuery = validator("query", (value): { q: string } => {
    const raw = value["q"];

    // A repeated parameter arrives as an array; treat the first value as the query.
    return {
        q: (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? ""
    };
});
// oxlint-enable id-length

const bookmarkApi = new Hono()
    .get("/api/bookmarks", searchQuery, async (context) => {
        context.header("Cache-Control", "no-store");

        try {
            return context.json(await listBookmarks(context.req.valid("query").q), httpStatus.ok);
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
    );

type BookmarkApi = typeof bookmarkApi;

export { type BookmarkApi, bookmarkApi };
