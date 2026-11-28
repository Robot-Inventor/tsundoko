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

    removeTrackingParams(normalized);

    return normalized.href;
};

export { normalizeBookmarkUrl };
