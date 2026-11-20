import { type } from "arktype";

const maxBookmarkUrlLength = 4096;
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

export { bookmarkUrl, invalidBookmarkUrlMessage, maxBookmarkUrlLength, parseBookmarkUrl };
