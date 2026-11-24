import { type Context, Hono } from "hono";
import { createRateLimit } from "./lib/rateLimit";
import { getBookmarkImageUrls } from "./db/bookmarks";
import { httpStatus } from "./lib/httpStatus";
import { parseContentType } from "./lib/mediaType";
import { readThumbnail } from "./lib/thumbnailStore";
import { runOutbound } from "./lib/outboundLimit";
import { type } from "arktype";
import { validator } from "hono/validator";

const fetchTimeout = 8000;
const maxImageBytes = 10_485_760;
const imageRequestLimit = 300;
const rateLimitWindowMs = 60_000;
// Thumbnails and favicons are stable per page, so letting the browser cache them for a day keeps reloads cheap.
const imageCacheControl = "private, max-age=86400";

const imageRateLimit = createRateLimit({ limit: imageRequestLimit, windowMs: rateLimitWindowMs });

// The proxy is keyed by bookmark id, so only saved bookmarks' images can be fetched.
const bookmarkId = type("string.uuid");

const imageIdQuery = validator("query", (value): string | null => {
    const raw = value["id"];
    const id = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

    return bookmarkId(id) instanceof type.errors ? null : id;
});

const readImage = async (body: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer>> => {
    const chunks: Uint8Array[] = [];
    let size = 0;

    for await (const chunk of body) {
        size += chunk.byteLength;

        if (size > maxImageBytes) {
            throw new Error("Proxied image exceeded its size limit");
        }

        chunks.push(chunk);
    }

    // Hono's `.body()` only accepts `Uint8Array<ArrayBuffer>`, and `Buffer.concat` returns a buffer typed as
    // `ArrayBufferLike`, so the bytes are copied into a plain `Uint8Array`.
    const bytes = new Uint8Array(size);
    let offset = 0;

    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return bytes;
};

const serveImage = async (context: Context, imageUrl: string | null): Promise<Response> => {
    // Error responses must not be cached by the browser, unlike successful ones.
    context.header("Cache-Control", "no-store");

    if (!imageUrl) {
        return context.body(null, httpStatus.notFound);
    }

    try {
        const response = await runOutbound(() =>
            fetch(imageUrl, {
                credentials: "omit",
                headers: {
                    accept: "image/*"
                },
                redirect: "follow",
                signal: AbortSignal.timeout(fetchTimeout)
            })
        );

        const contentType = parseContentType(response.headers.get("content-type"));
        // Browsers execute scripts in SVG loaded as a document, so serving it from the app origin would allow
        // stored XSS; only raster images are proxied.
        const usable =
            response.ok && contentType?.type === "image" && !contentType.subtype.startsWith("svg") && response.body;

        if (!usable) {
            await response.body?.cancel();

            return context.body(null, httpStatus.badGateway);
        }

        const image = await readImage(response.body);

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
    .get("/api/thumbnail", imageRateLimit, imageIdQuery, async (context) => {
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
    .get("/api/favicon", imageRateLimit, imageIdQuery, async (context) => {
        const faviconUrl = await getFaviconUrl(context.req.valid("query"), context.get("userId"));

        return serveImage(context, faviconUrl);
    });

export { imageApi };
