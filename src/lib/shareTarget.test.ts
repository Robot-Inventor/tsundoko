import {
    type SharedContent,
    extractSharedUrls,
    isExternalReferrer,
    isSharePath,
    needsShareConfirmation
} from "./shareTarget";
import { describe, expect, it } from "vitest";

const hrefs = (content: SharedContent): string[] => extractSharedUrls(content).map((url) => url.href);

describe("share gate", () => {
    it("recognises the share path regardless of case and trailing slashes", () => {
        expect(isSharePath("/share")).toBe(true);
        expect(isSharePath("/Share/")).toBe(true);
        expect(isSharePath("/share///")).toBe(true);
        expect(isSharePath("/archive")).toBe(false);
    });

    it("asks only for an unmarked cross-site navigation", () => {
        expect(needsShareConfirmation("cross-site", false)).toBe(true);
        expect(needsShareConfirmation("cross-site", true)).toBe(false);
        expect(needsShareConfirmation("none", false)).toBe(false);
        expect(needsShareConfirmation("", false)).toBe(false);
    });
});

describe("isExternalReferrer", () => {
    it("treats an absent referrer as a share target launch", () => {
        expect(isExternalReferrer("", "https://tsundoko.example")).toBe(false);
    });

    it("trusts a same-origin referrer", () => {
        expect(isExternalReferrer("https://tsundoko.example/archive", "https://tsundoko.example")).toBe(false);
    });

    it("flags a cross-origin referrer", () => {
        expect(isExternalReferrer("https://elsewhere.example/page", "https://tsundoko.example")).toBe(true);
    });
});

describe("extractSharedUrls", () => {
    it("uses the url parameter", () => {
        expect(hrefs({ title: "Example", url: "https://example.com/article" })).toEqual([
            "https://example.com/article"
        ]);
    });

    it("finds the URL in the text, as Android share sheets provide it", () => {
        expect(hrefs({ text: "Example https://example.com/article を共有" })).toEqual(["https://example.com/article"]);
    });

    it("collects every URL in the shared text", () => {
        expect(hrefs({ text: "https://example.com/a https://example.com/b" })).toEqual([
            "https://example.com/a",
            "https://example.com/b"
        ]);
    });

    it("keeps one copy of a URL that appears in several parameters", () => {
        expect(
            hrefs({
                text: "https://example.com/a",
                title: "https://example.com/a",
                url: "https://example.com/a"
            })
        ).toEqual(["https://example.com/a"]);
    });

    it("drops the punctuation around a URL", () => {
        expect(hrefs({ text: "See https://example.com/a." })).toEqual(["https://example.com/a"]);
    });

    it("drops an unmatched closing parenthesis around a URL", () => {
        expect(hrefs({ text: "[記事](https://example.com/article) を共有" })).toEqual(["https://example.com/article"]);

        expect(hrefs({ text: "(https://example.com)" })).toEqual(["https://example.com/"]);
    });

    it("keeps parentheses that belong to the URL", () => {
        expect(hrefs({ text: "https://en.wikipedia.org/wiki/Tsundoku_(disambiguation)" })).toEqual([
            "https://en.wikipedia.org/wiki/Tsundoku_(disambiguation)"
        ]);
    });

    it("stops at Japanese prose that touches the URL", () => {
        expect(hrefs({ text: "https://example.comを見て" })).toEqual(["https://example.com/"]);
    });

    it("keeps a non-ASCII path", () => {
        expect(hrefs({ text: "https://ja.wikipedia.org/wiki/日本語" })).toEqual([
            "https://ja.wikipedia.org/wiki/%E6%97%A5%E6%9C%AC%E8%AA%9E"
        ]);
    });

    it("keeps an internationalized domain name", () => {
        expect(hrefs({ text: "https://例え.jp/記事" })).toEqual(["https://xn--r8jz45g.jp/%E8%A8%98%E4%BA%8B"]);
    });

    it("accepts an uppercase scheme", () => {
        expect(hrefs({ text: "HTTPS://EXAMPLE.COM/PATH" })).toEqual(["https://example.com/PATH"]);
    });

    it("falls back to the title", () => {
        expect(hrefs({ title: "https://example.com/titled" })).toEqual(["https://example.com/titled"]);
    });

    it("returns nothing when no URL is shared", () => {
        expect(hrefs({ text: "リンクのないテキスト" })).toEqual([]);
    });

    it("ignores URLs that are not HTTP", () => {
        expect(hrefs({ text: "ftp://example.com/file" })).toEqual([]);
    });
});
