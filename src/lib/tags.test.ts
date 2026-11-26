import { describe, expect, it } from "vitest";
import { maxTagLength, maxTagsPerBookmark, normalizeTagNames } from "./tags";

const firstIndex = 0;
const onePastTheLimit = 1;
const letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"] as const;

describe("normalizeTagNames", () => {
    it("trims names and keeps the first spelling of a case-insensitive duplicate", () => {
        expect(normalizeTagNames(["  Work  ", "work", " Review "])).toEqual(["Work", "Review"]);
    });

    it("accepts a name at the length limit and the maximum number of tags", () => {
        const names = [
            "x".repeat(maxTagLength),
            ...letters.slice(firstIndex, maxTagsPerBookmark - onePastTheLimit)
        ] as const;

        expect(normalizeTagNames(names)).toHaveLength(maxTagsPerBookmark);
    });

    it("returns null for an empty name", () => {
        expect(normalizeTagNames(["Work", "   "])).toBeNull();
    });

    it("returns null for a name over the length limit", () => {
        expect(normalizeTagNames(["x".repeat(maxTagLength + onePastTheLimit)])).toBeNull();
    });

    it("returns null for more tags than the maximum", () => {
        expect(normalizeTagNames([...letters])).toBeNull();
    });
});
