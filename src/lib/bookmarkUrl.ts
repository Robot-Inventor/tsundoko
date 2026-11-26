import { type } from "arktype";

// Keep URL bytes below PostgreSQL's btree limit for the unique URL index.
const maxBookmarkUrlLength = 2000;
const bookmarkUrl = type("string.trim")
    .to(type("string").atMostLength(maxBookmarkUrlLength))
    .to("string.url.parse")
    .narrow((url) => {
        const isHttp = url.protocol === "http:" || url.protocol === "https:";

        return isHttp && !url.username && !url.password && url.href.length <= maxBookmarkUrlLength;
    });

const parseBookmarkUrl = (input: string): URL | null => {
    const parsed = bookmarkUrl(input);

    return parsed instanceof type.errors ? null : parsed;
};

// Canonicalise every share variant of X to one host so they become one bookmark.
const xHostnames = new Set([
    "x.com",
    "www.x.com",
    "mobile.x.com",
    "twitter.com",
    "www.twitter.com",
    "mobile.twitter.com"
]);

// Drop the fragment so a page with and without its anchor is treated as one bookmark.
const normalizeBookmarkUrl = (url: URL): string => {
    const normalized = new URL(url);
    normalized.hash = "";

    if (xHostnames.has(normalized.hostname)) {
        normalized.hostname = "x.com";
        normalized.protocol = "https:";
        normalized.searchParams.delete("a");
        normalized.searchParams.delete("s");
    }

    return normalized.href;
};

export { bookmarkUrl, maxBookmarkUrlLength, normalizeBookmarkUrl, parseBookmarkUrl };
