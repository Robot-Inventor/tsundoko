import { defaultSortBy, insertBySortBy, parseSortBy } from "./bookmarkSort";
import { describe, expect, it } from "vitest";
import type { Bookmark } from "./bookmark";

describe("parseSortBy", () => {
    it("keeps every supported sort option", () => {
        expect(parseSortBy("newest")).toBe("newest");
        expect(parseSortBy("oldest")).toBe("oldest");
        expect(parseSortBy("publishedNewest")).toBe("publishedNewest");
        expect(parseSortBy("publishedOldest")).toBe("publishedOldest");
        expect(parseSortBy("titleAsc")).toBe("titleAsc");
        expect(parseSortBy("titleDesc")).toBe("titleDesc");
    });

    it("falls back to the default for missing or unknown values", () => {
        expect(parseSortBy()).toBe(defaultSortBy);
        expect(parseSortBy(["newest"])).toBe(defaultSortBy);
        expect(parseSortBy("random")).toBe(defaultSortBy);
    });
});

interface BookmarkFixture {
    addedAt: string;
    id: string;
    publishedAt?: string;
}

const makeBookmark = ({ addedAt, id, publishedAt }: BookmarkFixture): Bookmark => ({
    addedAt: new Date(addedAt),
    description: null,
    faviconUrl: null,
    id,
    publishedAt: publishedAt ? new Date(publishedAt) : null,
    siteName: "example.com",
    thumbnailFit: "center",
    thumbnailUrl: null,
    title: id,
    url: `https://example.com/${id}`
});

const zebra = makeBookmark({ addedAt: "2024-01-01T00:00:00.000Z", id: "zebra" });
const alpha = makeBookmark({ addedAt: "2024-02-01T00:00:00.000Z", id: "alpha" });
const middle = makeBookmark({ addedAt: "2024-03-01T00:00:00.000Z", id: "middle" });
const beta = makeBookmark({ addedAt: "2024-04-01T00:00:00.000Z", id: "beta" });

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

describe("published-date ordering", () => {
    const older = makeBookmark({
        addedAt: "2024-01-01",
        id: "older",
        publishedAt: "2020-01-01"
    });

    const newer = makeBookmark({
        addedAt: "2024-01-02",
        id: "newer",
        publishedAt: "2023-01-01"
    });

    const undated = makeBookmark({
        addedAt: "2024-01-03",
        id: "undated"
    });

    it("puts an undated bookmark last when sorting by newest publication date", () => {
        const latest = makeBookmark({
            addedAt: "2024-01-04",
            id: "latest",
            publishedAt: "2024-01-01"
        });

        expect(insertBySortBy([newer, older, undated], latest, "publishedNewest").map((item) => item.id)).toEqual([
            "latest",
            "newer",
            "older",
            "undated"
        ]);
    });

    it("puts an undated bookmark first when sorting by oldest publication date", () => {
        expect(insertBySortBy([older, newer], undated, "publishedOldest").map((item) => item.id)).toEqual([
            "undated",
            "older",
            "newer"
        ]);
    });

    it("breaks equal publication dates by added date descending", () => {
        const addedEarlier = makeBookmark({
            addedAt: "2024-01-01",
            id: "addedEarlier",
            publishedAt: "2022-01-01"
        });

        const addedLater = makeBookmark({
            addedAt: "2024-02-01",
            id: "addedLater",
            publishedAt: "2022-01-01"
        });

        expect(insertBySortBy([addedEarlier], addedLater, "publishedNewest").map((item) => item.id)).toEqual([
            "addedLater",
            "addedEarlier"
        ]);
    });
});
