import type { BookmarkPreview } from "./bookmark";
import { decodeBuffer } from "encoding-sniffer";
import { extractArticleContent } from "./articleContent";
import { isXPostUrl } from "./xPost";
import ogs from "open-graph-scraper";
import { parseBookmarkUrl } from "./bookmarkUrl";
import { parseContentType } from "./mediaType";

const maxRedirects = 5;
const fetchTimeout = 8000;
const maxHtmlBytes = 2_097_152;
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

// `url` and `thumbnailFile` are filled by the save path, so the page fetch returns the rest only.
type PreviewData = Omit<BookmarkPreview, "thumbnailFile" | "url"> & { content: string | null };

const getPreview = async (url: URL): Promise<PreviewData> => {
    const { html, pageUrl } = await fetchHtml(url);
    const { result } = await ogs({ html, onlyGetOpenGraphInfo: ["image"] });

    return {
        // X post pages have no article body: xeet renders the text into the title instead,
        // so the expensive extraction is skipped rather than discarded afterwards.
        content: isXPostUrl(url) ? null : await extractArticleContent(html),
        description:
            cleanText(result.ogDescription, maxDescriptionLength) ??
            cleanText(result.twitterDescription, maxDescriptionLength),
        faviconUrl: imageUrl(result.favicon, pageUrl),
        siteName: cleanText(result.ogSiteName, maxSiteNameLength) ?? pageUrl.hostname,
        thumbnailUrl: imageUrl(result.ogImage?.[0]?.url, pageUrl) ?? imageUrl(result.twitterImage?.[0]?.url, pageUrl),
        title:
            cleanText(result.ogTitle, maxTitleLength) ??
            cleanText(result.twitterTitle, maxTitleLength) ??
            pageUrl.hostname
    };
};

export { type PreviewData, getPreview };
