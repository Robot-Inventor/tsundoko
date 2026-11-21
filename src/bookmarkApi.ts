import { type BookmarkPreview, bookmarkMessages } from "./lib/bookmark";
import { bookmarkExists, insertBookmark, listBookmarks } from "./db/bookmarks";
import { bookmarkUrl, invalidBookmarkUrlMessage, parseBookmarkUrl } from "./lib/bookmarkUrl";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { decodeBuffer } from "encoding-sniffer";
import ogs from "open-graph-scraper";
import { parseContentType } from "./lib/mediaType";
import { type } from "arktype";
import { validator } from "hono/validator";

const maxRedirects = 5;
const fetchTimeout = 8000;
const maxHtmlBytes = 2_097_152;
const maxRequestBytes = 16_384;
const maxDescriptionLength = 1000;
const maxSiteNameLength = 150;
const maxTitleLength = 300;
const redirectStatuses = new Set(
    Object.values({
        found: 302,
        movedPermanently: 301,
        permanentRedirect: 308,
        seeOther: 303,
        temporaryRedirect: 307
    })
);

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

const normalizeBookmarkUrl = (url: URL): string => {
    const normalized = new URL(url);
    normalized.hash = "";

    return normalized.href;
};

const readHtml = async (body: ReadableStream<Uint8Array>, charset: string | null): Promise<string> => {
    const chunks: Uint8Array[] = [];
    let size = 0;

    for await (const chunk of body) {
        size += chunk.byteLength;

        if (size > maxHtmlBytes) {
            throw new Error("Preview HTML exceeded its size limit");
        }

        chunks.push(chunk);
    }

    return decodeBuffer(Buffer.concat(chunks, size), {
        defaultEncoding: "UTF-8",
        transportLayerEncodingLabel: charset ?? ""
    });
};

interface HtmlPage {
    html: string;
    pageUrl: URL;
}

const fetchHtml = async (
    pageUrl: URL,
    signal = AbortSignal.timeout(fetchTimeout),
    redirectsRemaining = maxRedirects
): Promise<HtmlPage> => {
    const response = await fetch(pageUrl, {
        credentials: "omit",
        headers: {
            accept: "text/html, application/xhtml+xml"
        },
        redirect: "manual",
        signal
    });

    if (redirectStatuses.has(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");

        if (!location || !redirectsRemaining) {
            throw new Error("Preview redirect could not be followed");
        }

        const destination = parseBookmarkUrl(new URL(location, pageUrl).href);

        if (!destination) {
            throw new Error("Unsupported preview redirect URL");
        }

        // oxlint-disable-next-line no-magic-numbers -- Consume a single hop without resetting the shared deadline.
        return fetchHtml(destination, signal, redirectsRemaining - 1);
    }

    const contentType = parseContentType(response.headers.get("content-type"));
    const mediaType = contentType?.essence;
    const isHtml = mediaType === "text/html" || mediaType === "application/xhtml+xml";
    const usable = response.ok && response.body && isHtml;

    if (!usable) {
        await response.body?.cancel();

        throw new Error("Preview request did not return HTML");
    }

    return {
        html: await readHtml(response.body, contentType?.params.get("charset") ?? null),
        pageUrl
    };
};

const cleanText = (value: string | undefined, length: number): string | null => {
    const trimmed = value?.trim();

    // oxlint-disable-next-line no-magic-numbers -- Keep the first `length` characters.
    return trimmed ? trimmed.slice(0, length) : null;
};

const imageUrl = (value: string | undefined, pageUrl: URL): string | null => {
    if (!value?.trim()) {
        return null;
    }

    try {
        const url = parseBookmarkUrl(new URL(value, pageUrl).href);

        return url?.protocol === "https:" ? url.href : null;
    } catch {
        return null;
    }
};

const getPreview = async (url: URL): Promise<BookmarkPreview> => {
    const { html, pageUrl } = await fetchHtml(url);
    const { result } = await ogs({ html, onlyGetOpenGraphInfo: ["image"] });

    return {
        description:
            cleanText(result.ogDescription, maxDescriptionLength) ??
            cleanText(result.twitterDescription, maxDescriptionLength),
        faviconUrl: imageUrl(result.favicon, pageUrl),
        siteName: cleanText(result.ogSiteName, maxSiteNameLength) ?? pageUrl.hostname,
        thumbnailUrl: imageUrl(result.ogImage?.[0]?.url, pageUrl) ?? imageUrl(result.twitterImage?.[0]?.url, pageUrl),
        title:
            cleanText(result.ogTitle, maxTitleLength) ??
            cleanText(result.twitterTitle, maxTitleLength) ??
            pageUrl.hostname,
        url: normalizeBookmarkUrl(url)
    };
};

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

            const preview = await getPreview(input.url).catch(() => null);

            if (!preview) {
                return context.json({ error: bookmarkMessages.fetchFailed }, httpStatus.badGateway);
            }

            try {
                const saved = await insertBookmark(preview);

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
