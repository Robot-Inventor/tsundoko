import { type } from "arktype";

// Keep URL bytes below PostgreSQL's btree limit for the unique URL index.
const maxBookmarkUrlLength = 2000;
const invalidBookmarkUrlMessage = "http://またはhttps://で始まるURLを入力してください。";

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

// Drop the fragment so a page with and without its anchor is treated as one bookmark.
const normalizeBookmarkUrl = (url: URL): string => {
    const normalized = new URL(url);
    normalized.hash = "";

    return normalized.href;
};

export { bookmarkUrl, invalidBookmarkUrlMessage, maxBookmarkUrlLength, normalizeBookmarkUrl, parseBookmarkUrl };
