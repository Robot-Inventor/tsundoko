import { describe, expect, it } from "vitest";
import { normalizeBookmarkUrl } from "./normalizeBookmarkUrl";

describe("normalizeBookmarkUrl", () => {
    it("drops X and general tracking parameters but keeps other query parameters", () => {
        const url = new URL("https://x.com/user/status/123?s=20&a=1&t=abc&utm_source=share");

        expect(normalizeBookmarkUrl(url)).toBe("https://x.com/user/status/123?t=abc");
    });

    it("canonicalises every X host to https://x.com", () => {
        const hosts = [
            "x.com",
            "www.x.com",
            "mobile.x.com",
            "twitter.com",
            "www.twitter.com",
            "mobile.twitter.com"
        ] as const;

        for (const host of hosts) {
            expect(normalizeBookmarkUrl(new URL(`http://${host}/user?a=1`))).toBe("https://x.com/user");
        }
    });

    it("leaves other sites untouched apart from the fragment", () => {
        const url = new URL("http://example.com/path?a=1&s=2&keep=3#section");

        expect(normalizeBookmarkUrl(url)).toBe("http://example.com/path?a=1&s=2&keep=3");
    });

    it("removes every lowercase a and s but keeps uppercase keys", () => {
        const url = new URL("https://x.com/explore?a=1&s=2&a=3&A=4&S=5");

        expect(normalizeBookmarkUrl(url)).toBe("https://x.com/explore?A=4&S=5");
    });
});
