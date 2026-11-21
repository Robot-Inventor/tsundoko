import { Hono } from "hono";
import { getBookmarkThumbnailUrl } from "./db/bookmarks";
import { parseContentType } from "./lib/mediaType";
import { type } from "arktype";
import { validator } from "hono/validator";

const fetchTimeout = 8000;
const maxImageBytes = 10_485_760;
// Thumbnails are stable per page, so letting the browser cache them for a day keeps reloads cheap.
const thumbnailCacheControl = "public, max-age=86400";

const httpStatus = {
    badGateway: 502,
    notFound: 404
} as const;

// The proxy is keyed by bookmark id, so only saved bookmarks' thumbnails can be fetched.
const bookmarkId = type("string.uuid");

const thumbnailQuery = validator("query", (value): string | null => {
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
            throw new Error("Thumbnail image exceeded its size limit");
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

const thumbnailApi = new Hono().get("/api/thumbnail", thumbnailQuery, async (context) => {
    context.header("Cache-Control", "no-store");

    const id = context.req.valid("query");
    const thumbnailUrl = id ? await getBookmarkThumbnailUrl(id) : null;

    if (!thumbnailUrl) {
        return context.body(null, httpStatus.notFound);
    }

    try {
        const response = await fetch(thumbnailUrl, {
            credentials: "omit",
            headers: {
                accept: "image/*"
            },
            redirect: "follow",
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

        const image = await readImage(response.body);

        context.header("content-type", contentType.essence);
        context.header("Cache-Control", thumbnailCacheControl);

        return context.body(image);
    } catch {
        return context.body(null, httpStatus.badGateway);
    }
});

export { thumbnailApi };
