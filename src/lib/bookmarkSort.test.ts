import { defaultSortBy, insertBySortBy, parseSortBy } from "./bookmarkSort";
import { describe, expect, it } from "vitest";
import type { Bookmark } from "./bookmark";

describe("parseSortBy", () => {
    it("keeps every supported sort option", () => {
        expect(parseSortBy("newest")).toBe("newest");
        expect(parseSortBy("oldest")).toBe("oldest");
        expect(parseSortBy("titleAsc")).toBe("titleAsc");
        expect(parseSortBy("titleDesc")).toBe("titleDesc");
    });

    it("falls back to the default for missing or unknown values", () => {
        expect(parseSortBy()).toBe(defaultSortBy);
        expect(parseSortBy(["newest"])).toBe(defaultSortBy);
        expect(parseSortBy("random")).toBe(defaultSortBy);
    });
});

const makeBookmark = (id: string, title: string, addedAt: string): Bookmark => ({
    addedAt: new Date(addedAt),
    description: null,
    faviconUrl: null,
    id,
    siteName: "example.com",
    thumbnailFit: "center",
    thumbnailUrl: null,
    title,
    url: `https://example.com/${id}`
});

const zebra = makeBookmark("zebra", "zebra", "2024-01-01T00:00:00.000Z");
const alpha = makeBookmark("alpha", "alpha", "2024-02-01T00:00:00.000Z");
const middle = makeBookmark("middle", "middle", "2024-03-01T00:00:00.000Z");
const beta = makeBookmark("beta", "beta", "2024-04-01T00:00:00.000Z");

describe("insertBySortBy", () => {
    it("puts a new bookmark at the top of the newest-first list", () => {
        expect(insertBySortBy([middle, alpha, zebra], beta, "newest").map((bookmark) => bookmark.id)).toEqual([
            "beta",
            "middle",
            "alpha",
            "zebra"
        ]);
    });

    it("puts a new bookmark at the bottom of the oldest-first list", () => {
        expect(insertBySortBy([zebra, alpha, middle], beta, "oldest").map((bookmark) => bookmark.id)).toEqual([
            "zebra",
            "alpha",
            "middle",
            "beta"
        ]);
    });

    it("inserts a new bookmark by title in ascending order", () => {
        expect(insertBySortBy([alpha, middle, zebra], beta, "titleAsc").map((bookmark) => bookmark.id)).toEqual([
            "alpha",
            "beta",
            "middle",
            "zebra"
        ]);
    });

    it("inserts a new bookmark by title in descending order", () => {
        expect(insertBySortBy([zebra, middle, alpha], beta, "titleDesc").map((bookmark) => bookmark.id)).toEqual([
            "zebra",
            "middle",
            "beta",
            "alpha"
        ]);
    });
});
