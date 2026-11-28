import { type } from "arktype";

// Keep URL bytes below PostgreSQL's btree limit for the unique URL index.
const maxBookmarkUrlLength = 2000;
// OGP image URLs embed titles and logos, and their columns are neither indexed nor bounded.
const maxImageUrlLength = 4096;

const narrowHttpUrl =
    (maxLength: number): ((url: URL) => boolean) =>
    (url) => {
        const isHttp = url.protocol === "http:" || url.protocol === "https:";

        return isHttp && !url.username && !url.password && url.href.length <= maxLength;
    };

const bookmarkUrl = type("string.trim")
    .to(type("string").atMostLength(maxBookmarkUrlLength))
    .to("string.url.parse")
    .narrow(narrowHttpUrl(maxBookmarkUrlLength));

const imageUrl = type("string.trim")
    .to(type("string").atMostLength(maxImageUrlLength))
    .to("string.url.parse")
    .narrow(narrowHttpUrl(maxImageUrlLength));

const parseUrl = (schema: typeof bookmarkUrl, input: string): URL | null => {
    const parsed = schema(input);

    return parsed instanceof type.errors ? null : parsed;
};

const parseBookmarkUrl = (input: string): URL | null => parseUrl(bookmarkUrl, input);
const parseImageUrl = (input: string): URL | null => parseUrl(imageUrl, input);

export { bookmarkUrl, maxBookmarkUrlLength, parseBookmarkUrl, parseImageUrl };
