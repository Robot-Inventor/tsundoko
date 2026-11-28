// oxlint-disable import/max-dependencies -- Fetching, decoding, OG parsing, article extraction, and date parsing all meet here.
import type { BookmarkPreview } from "./bookmark";
import { decodeBuffer } from "encoding-sniffer";
import { extractArticleContent } from "./articleContent";
import { extractPublishedDate } from "./publishedDate";
import { isXPostUrl } from "./xPost";
import ogs from "open-graph-scraper";
import { parseBookmarkUrl } from "./bookmarkUrl";
import { parseContentType } from "./mediaType";
import { publicFetch } from "./publicFetch";
import { readCappedBody } from "./cappedBody";
import { userAgent } from "./userAgent";

const fetchTimeout = 8000;

const maxHtmlBytes = 2_097_152;
const maxDescriptionLength = 1000;
const maxSiteNameLength = 150;
const maxTitleLength = 300;

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

// `url` is filled by the save path, so the preview carries the rest only.
type PreviewData = Omit<BookmarkPreview, "url"> & {
    content: string | null;
    publishedAt?: Date | null;
};

// Redirects can land on a different URL, which the save path normalises.
interface FetchedPage {
    pageUrl: URL;
    preview: PreviewData;
}

const getPreview = async (url: URL): Promise<FetchedPage> => {
    const { response, url: pageUrl } = await publicFetch(url, {
        credentials: "omit",
        headers: {
            accept: "text/html, application/xhtml+xml",
            "user-agent": userAgent
        },
        signal: AbortSignal.timeout(fetchTimeout)
    });

    const contentType = parseContentType(response.headers.get("content-type"));
    const mediaType = contentType?.essence;
    const isHtml = mediaType === "text/html" || mediaType === "application/xhtml+xml";
    const usable = response.ok && response.body && isHtml;

    if (!usable) {
        await response.body?.cancel();

        throw new Error("Preview request did not return HTML");
    }

    const html = decodeBuffer(await readCappedBody(response.body, maxHtmlBytes), {
        defaultEncoding: "UTF-8",
        transportLayerEncodingLabel: contentType?.params.get("charset") ?? ""
    });

    const { result } = await ogs({ html, onlyGetOpenGraphInfo: ["image"] });

    return {
        pageUrl,
        preview: {
            // X post pages have no article body: xeet renders the text into the title instead,
            // so the expensive extraction is skipped rather than discarded afterwards.
            content: isXPostUrl(url) ? null : await extractArticleContent(html),
            description:
                cleanText(result.ogDescription, maxDescriptionLength) ??
                cleanText(result.twitterDescription, maxDescriptionLength),
            faviconUrl: imageUrl(result.favicon, pageUrl),
            publishedAt: extractPublishedDate(result),
            siteName: cleanText(result.ogSiteName, maxSiteNameLength) ?? pageUrl.hostname,
            thumbnailUrl:
                imageUrl(result.ogImage?.[0]?.url, pageUrl) ?? imageUrl(result.twitterImage?.[0]?.url, pageUrl),
            title:
                cleanText(result.ogTitle, maxTitleLength) ??
                cleanText(result.twitterTitle, maxTitleLength) ??
                pageUrl.hostname
        }
    };
};

export { type PreviewData, getPreview };
