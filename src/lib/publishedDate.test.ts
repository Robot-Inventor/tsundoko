import { describe, expect, it } from "vitest";
import { extractPublishedDate } from "./publishedDate";

describe("extractPublishedDate", () => {
    it("prefers the OGP article time over JSON-LD and the date fallback", () => {
        const date = extractPublishedDate({
            articlePublishedTime: "2024-01-15T10:30:00Z",
            jsonLD: [
                {
                    datePublished: "2020-01-01"
                }
            ],
            ogDate: "2019-01-01"
        });

        expect(date?.toISOString()).toBe("2024-01-15T10:30:00.000Z");
    });

    it("falls back to JSON-LD datePublished when OGP has no date", () => {
        const date = extractPublishedDate({
            jsonLD: [
                {
                    "@graph": [
                        {
                            datePublished: "2023-06-07"
                        }
                    ]
                }
            ],
            ogDate: "2019-01-01"
        });

        expect(date?.toISOString()).toBe("2023-06-07T00:00:00.000Z");
    });

    it("uses the scraper's date fallback last", () => {
        const date = extractPublishedDate({
            ogDate: "2021-02-03"
        });

        expect(date?.toISOString()).toBe("2021-02-03T00:00:00.000Z");
    });

    it("returns null for missing or unparseable dates", () => {
        expect(extractPublishedDate({})).toBeNull();
        expect(
            extractPublishedDate({
                articlePublishedTime: "not a date",
                ogDate: "  "
            })
        ).toBeNull();
    });
});
