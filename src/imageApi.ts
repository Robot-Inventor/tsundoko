import { type Context, Hono } from "hono";
import { getBookmarkImageUrls } from "./db/bookmarks";
import { httpStatus } from "./lib/httpStatus";
import { parseBookmarkUrl } from "./lib/bookmarkUrl";
import { parseContentType } from "./lib/mediaType";
import { publicFetch } from "./lib/publicFetch";
import { readCappedBody } from "./lib/cappedBody";
import { readThumbnail } from "./lib/thumbnailStore";
import { type } from "arktype";
import { validator } from "hono/validator";

const fetchTimeout = 8000;
const maxImageBytes = 10_485_760;
// Thumbnails and favicons are stable per page, so letting the browser cache them for a day keeps reloads cheap.
const imageCacheControl = "private, max-age=86400";

// The proxy is keyed by bookmark id, so only saved bookmarks' images can be fetched.
const bookmarkId = type("string.uuid");

const imageIdQuery = validator("query", (value): string | null => {
    const raw = value["id"];
    const id = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

    return bookmarkId(id) instanceof type.errors ? null : id;
});

const serveImage = async (context: Context, imageUrl: string | null): Promise<Response> => {
    // Error responses must not be cached by the browser, unlike successful ones.
    context.header("Cache-Control", "no-store");

    if (!imageUrl) {
        return context.body(null, httpStatus.notFound);
    }

    const url = parseBookmarkUrl(imageUrl);

    if (!url) {
        return context.body(null, httpStatus.badGateway);
    }

    try {
        // One deadline covers every hop; a redirect chain cannot extend the request indefinitely.
        const { response } = await publicFetch(url, {
            credentials: "omit",
            headers: {
                accept: "image/*"
            },
            signal: AbortSignal.timeout(fetchTimeout)
        });

        const contentType = parseContentType(response.headers.get("content-type"));
        // Browsers execute scripts in SVG loaded as a document, so serving it from the app origin would allow
        // stored XSS; only raster images are proxied.
        const usable =
            response.ok && contentType?.type === "image" && !contentType.subtype.startsWith("svg") && response.body;

        if (!usable) {
            await response.body?.cancel();

            return context.body(null, httpStatus.badGateway);
        }

        // Hono's `.body()` only accepts `Uint8Array<ArrayBuffer>`, so the bytes are copied out of the
        // Buffer, which is typed as `ArrayBufferLike`, into a plain `Uint8Array`.
        const image = new Uint8Array(await readCappedBody(response.body, maxImageBytes));

        context.header("content-type", contentType.essence);
        context.header("Cache-Control", imageCacheControl);

        return context.body(image);
    } catch {
        return context.body(null, httpStatus.badGateway);
    }
};

const getFaviconUrl = async (id: string | null, userId: string): Promise<string | null> => {
    const bookmark = id ? await getBookmarkImageUrls(id, userId) : null;

    if (!bookmark) {
        return null;
    }

    // SVG cannot pass serveImage's validation, so Google's favicon service renders those instead.
    const stored = bookmark.faviconUrl?.endsWith(".svg") ? null : bookmark.faviconUrl;

    const googleFaviconUrl = new URL("https://www.google.com/s2/favicons");
    googleFaviconUrl.searchParams.set("domain", new URL(bookmark.url).hostname);
    googleFaviconUrl.searchParams.set("sz", "32");

    return stored ?? googleFaviconUrl.href;
};

const imageApi = new Hono<{ Variables: { userId: string } }>()
    .get("/api/thumbnail", imageIdQuery, async (context) => {
        const id = context.req.valid("query");
        const bookmark = id ? await getBookmarkImageUrls(id, context.get("userId")) : null;
        const stored = bookmark?.thumbnailFile ? await readThumbnail(bookmark.thumbnailFile) : null;

        if (stored) {
            context.header("content-type", "image/png");
            context.header("Cache-Control", imageCacheControl);

            return context.body(stored);
        }

        return serveImage(context, bookmark?.thumbnailUrl ?? null);
    })
    .get("/api/favicon", imageIdQuery, async (context) => {
        const faviconUrl = await getFaviconUrl(context.req.valid("query"), context.get("userId"));

        return serveImage(context, faviconUrl);
    });

export { imageApi };
