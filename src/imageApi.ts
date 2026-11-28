import { type Context, Hono } from "hono";
import { RateLimiterRes, runImageOutbound } from "./lib/outboundLimit";
import {
    cacheRemoteFavicon,
    cacheRemoteThumbnail,
    googleFaviconUrl,
    readFavicon,
    readThumbnail
} from "./lib/imageCache";
import type { AuthEnv } from "./authMiddleware";
import { createRateLimit } from "./lib/rateLimit";
import { fetchValidImage } from "./lib/remoteImage";
import { getBookmarkImageUrls } from "./db/bookmarks";
import { httpStatus } from "./lib/httpStatus";
import { type } from "arktype";
import { validator } from "hono/validator";

const imageRequestLimit = 5000;
// The cache key is the bookmark id or the site's hostname, and neither is reused for different
// content, so a browser can keep a cached image for a month without revalidating it.
const imageCacheControl = "private, max-age=2592000, immutable";
// A proxy response is a temporary stand-in for an image the cache could not store, and it holds
// third-party bytes, so it gets a shorter lifetime without the immutable promise.
const proxyCacheControl = "private, max-age=86400";

const imageRateLimit = createRateLimit({ limit: imageRequestLimit });

// The proxy is keyed by bookmark id, so only saved bookmarks' images can be fetched.
const bookmarkId = type("string.uuid");

const imageIdQuery = validator("query", (value): string | null => {
    const raw = value["id"];
    const id = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

    return bookmarkId(id) instanceof type.errors ? null : id;
});

const rateLimited = (context: Context<AuthEnv>): Response => {
    context.header("Retry-After", "1");

    return context.body(null, httpStatus.serviceUnavailable);
};

const serveCached = (context: Context<AuthEnv>, webp: Uint8Array<ArrayBuffer>): Response => {
    context.header("content-type", "image/webp");
    context.header("Cache-Control", imageCacheControl);

    return context.body(webp);
};

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
        context.header("Cache-Control", proxyCacheControl);

        return context.body(image.bytes);
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            return rateLimited(context);
        }

        return context.body(null, httpStatus.badGateway);
    }
};

// A cache miss is filled inside the request that noticed it; the same bytes are then served instead
// of reading the file back. When the fill cannot produce a usable image, the plain proxy below is
// still tried, so a page that sharp rejects can still render in the browser.
const fillCache = async (
    context: Context<AuthEnv>,
    fill: () => Promise<Uint8Array<ArrayBuffer> | null>,
    fallbackUrl: string | null
): Promise<Response> => {
    try {
        const cached = await runImageOutbound(context.get("userId"), fill);

        if (cached) {
            return serveCached(context, cached);
        }
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            return rateLimited(context);
        }
    }

    return serveImage(context, fallbackUrl);
};

const imageApi = new Hono<AuthEnv>()
    .get("/api/thumbnail", imageRateLimit, imageIdQuery, async (context) => {
        context.header("Cache-Control", "no-store");

        const id = context.req.valid("query");

        if (!id) {
            return context.body(null, httpStatus.notFound);
        }

        const userId = context.get("userId");
        const bookmark = await getBookmarkImageUrls(id, userId);

        if (!bookmark) {
            return context.body(null, httpStatus.notFound);
        }

        const stored = await readThumbnail(id);

        if (stored) {
            return serveCached(context, stored);
        }

        const { thumbnailUrl } = bookmark;

        return fillCache(
            context,
            () => (thumbnailUrl ? cacheRemoteThumbnail(id, thumbnailUrl) : Promise.resolve(null)),
            thumbnailUrl
        );
    })
    .get("/api/favicon", imageRateLimit, imageIdQuery, async (context) => {
        context.header("Cache-Control", "no-store");

        const id = context.req.valid("query");
        const userId = context.get("userId");
        const bookmark = id ? await getBookmarkImageUrls(id, userId) : null;

        if (!bookmark) {
            return context.body(null, httpStatus.notFound);
        }

        const { hostname } = new URL(bookmark.url);
        const stored = await readFavicon(hostname);

        if (stored) {
            return serveCached(context, stored);
        }

        return fillCache(
            context,
            () => cacheRemoteFavicon(hostname, bookmark.faviconUrl),
            // Google renders the sources the page favicon cannot, so retry it instead of the stored URL.
            googleFaviconUrl(hostname)
        );
    });

export { imageApi };
