// oxlint-disable id-length -- "q" is the search parameter name defined by the URL.
import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "./searchQuery";

describe("parseSearchQuery", () => {
    it("trims a search term from the URL", () => {
        expect(parseSearchQuery({ q: "  bookmarks  " })).toEqual({ q: "bookmarks" });
    });

    it("treats a whitespace-only term as no search", () => {
        expect(parseSearchQuery({ q: "   " })).toEqual({});
    });

    it("treats a missing term as no search", () => {
        expect(parseSearchQuery({})).toEqual({});
    });

    it("ignores a non-string term", () => {
        expect(parseSearchQuery({ q: 42 })).toEqual({});
    });

    it("ignores a repeated term", () => {
        expect(parseSearchQuery({ q: ["one", "two"] })).toEqual({});
    });
});
