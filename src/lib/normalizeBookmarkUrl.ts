import { removeTrackingParams } from "./trackingParams";

// Canonicalise every share variant of X to one host so they become one bookmark.
const xHostnames = new Set([
    "x.com",
    "www.x.com",
    "mobile.x.com",
    "twitter.com",
    "www.twitter.com",
    "mobile.twitter.com"
]);

// Storefronts from Robot-Inventor/amazon-music-rich-presence, with their www variants.
// Ref links are kept beside each region so the list can be rechecked later.
// Ref: https://en.wikipedia.org/wiki/Amazon_Music
const amazonHostnames = new Set([
    "amazon.com",
    "www.amazon.com",
    "amazon.de",
    "www.amazon.de",
    "amazon.in",
    "www.amazon.in",
    "amazon.co.jp",
    "www.amazon.co.jp",
    "amazon.co.uk",
    "www.amazon.co.uk",
    "amazon.ca",
    "www.amazon.ca",
    "amazon.com.br",
    "www.amazon.com.br",
    "amazon.com.mx",
    "www.amazon.com.mx",
    "amazon.it",
    "www.amazon.it",
    "amazon.fr",
    "www.amazon.fr",
    "amazon.es",
    "www.amazon.es",
    "amazon.com.au",
    "www.amazon.com.au"
]);

// The ASIN sits after /dp/ or the legacy /gp/product/; a title slug may precede it,
// and a trailing slash or path-style ref segment may follow it.
const amazonProductPath = /\/(?:dp|gp\/product)\/(?<asin>[^/?#]+)/u;

// Drop the fragment and tracking parameters so equivalent pages become one bookmark.
const normalizeBookmarkUrl = (url: URL): string => {
    const normalized = new URL(url);
    normalized.hash = "";

    if (xHostnames.has(normalized.hostname)) {
        normalized.hostname = "x.com";
        normalized.protocol = "https:";
        normalized.searchParams.delete("a");
        normalized.searchParams.delete("s");
    }

    if (amazonHostnames.has(normalized.hostname)) {
        const asin = amazonProductPath.exec(normalized.pathname)?.groups?.["asin"];

        if (asin) {
            return `https://${normalized.hostname}/dp/${asin}`;
        }
    }

    removeTrackingParams(normalized);

    return normalized.href;
};

export { normalizeBookmarkUrl };
