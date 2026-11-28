/* oxlint-disable no-magic-numbers -- These tests assert the URL length boundaries. */
import { describe, expect, it } from "vitest";
import { parseBookmarkUrl, parseImageUrl } from "./bookmarkUrl";

const urlOfLength = (length: number): string => `https://example.com/${"a".repeat(length - 20)}`;

describe("parseBookmarkUrl", () => {
    it("rejects a URL longer than the bookmark limit", () => {
        expect(parseBookmarkUrl(urlOfLength(2001))).toBeNull();
    });
});

describe("parseImageUrl", () => {
    it("accepts a long OGP image URL that fits the image limit", () => {
        expect(parseImageUrl(urlOfLength(2509))).not.toBeNull();
    });

    it("rejects an image URL longer than the image limit", () => {
        expect(parseImageUrl(urlOfLength(4097))).toBeNull();
    });
});
