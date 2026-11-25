import { type Context, Hono } from "hono";
import { RateLimiterRes, runImageOutbound, runThumbnailRead } from "./lib/outboundLimit";
import type { AuthEnv } from "./authMiddleware";
import { createRateLimit } from "./lib/rateLimit";
import { fetchValidImage } from "./lib/remoteImage";
import { getBookmarkImageUrls } from "./db/bookmarks";
import { httpStatus } from "./lib/httpStatus";
import { readThumbnail } from "./lib/thumbnailStore";
import { type } from "arktype";
import { validator } from "hono/validator";

const imageRequestLimit = 5000;
// Thumbnails and favicons are stable per page, so letting the browser cache them for a day keeps reloads cheap.
const imageCacheControl = "private, max-age=86400";

const imageRateLimit = createRateLimit({ limit: imageRequestLimit });

// The proxy is keyed by bookmark id, so only saved bookmarks' images can be fetched.
const bookmarkId = type("string.uuid");

const imageIdQuery = validator("query", (value): string | null => {
    const raw = value["id"];
    const id = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

    return bookmarkId(id) instanceof type.errors ? null : id;
});

const serveImage = async (context: Context<AuthEnv>, imageUrl: string | null): Promise<Response> => {
    // Error responses must not be cached by the browser, unlike successful ones.
    context.header("Cache-Control", "no-store");

    if (!imageUrl) {
        return context.body(null, httpStatus.notFound);
    }

    try {
        // The slot stays held until the body has been read: the 10 MiB buffer is the expensive part,
        // not just the connection.
        const image = await runImageOutbound(context.get("userId"), () => fetchValidImage(imageUrl));

        if (!image) {
            return context.body(null, httpStatus.badGateway);
        }

        context.header("content-type", image.mediaType);
        context.header("Cache-Control", imageCacheControl);

        return context.body(image.bytes);
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            context.header("Retry-After", "1");

            return context.body(null, httpStatus.serviceUnavailable);
        }

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

const imageApi = new Hono<AuthEnv>()
    .get("/api/thumbnail", imageRateLimit, imageIdQuery, async (context) => {
        context.header("Cache-Control", "no-store");

        const id = context.req.valid("query");
        const bookmark = id ? await getBookmarkImageUrls(id, context.get("userId")) : null;

        if (bookmark?.thumbnailFile) {
            const { thumbnailFile } = bookmark;

            try {
                const stored = await runThumbnailRead(context.get("userId"), () => readThumbnail(thumbnailFile));

                if (stored) {
                    context.header("content-type", "image/png");
                    context.header("Cache-Control", imageCacheControl);

                    return context.body(stored);
                }
            } catch (error) {
                if (error instanceof RateLimiterRes) {
                    context.header("Retry-After", "1");

                    return context.body(null, httpStatus.serviceUnavailable);
                }

                throw error;
            }
        }

        return serveImage(context, bookmark?.thumbnailUrl ?? null);
    })
    .get("/api/favicon", imageRateLimit, imageIdQuery, async (context) => {
        const faviconUrl = await getFaviconUrl(context.req.valid("query"), context.get("userId"));

        return serveImage(context, faviconUrl);
    });

export { imageApi };
