import { describe, expect, it } from "vitest";
import { jsonLdDatePublished } from "./jsonLdDate";

describe("jsonLdDatePublished", () => {
    it("reads datePublished from a top-level object", () => {
        const jsonLD: object[] = [
            {
                "@type": "Article",
                datePublished: "2024-01-15T09:00:00Z"
            }
        ];

        expect(jsonLdDatePublished(jsonLD)).toBe("2024-01-15T09:00:00Z");
    });

    it("finds datePublished inside @graph and nested arrays", () => {
        const jsonLD: object[] = [
            {
                "@graph": [
                    {
                        "@type": "WebSite",
                        name: "Example"
                    },
                    {
                        "@type": "NewsArticle",
                        datePublished: ["2023-05-01", "2024-05-01"]
                    }
                ]
            }
        ];

        expect(jsonLdDatePublished(jsonLD)).toBe("2023-05-01");
    });

    it("accepts a full IRI key and an expanded @value", () => {
        const jsonLD: object[] = [
            {
                "https://schema.org/datePublished": {
                    "@value": "2022-03-04T00:00:00Z"
                }
            }
        ];

        expect(jsonLdDatePublished(jsonLD)).toBe("2022-03-04T00:00:00Z");
    });

    it("returns null when there is no usable date", () => {
        expect(jsonLdDatePublished()).toBeNull();
        expect(
            jsonLdDatePublished([
                {
                    "@type": "Article",
                    dateModified: "2024-01-15"
                }
            ])
        ).toBeNull();

        expect(
            jsonLdDatePublished([
                {
                    datePublished: "  "
                }
            ])
        ).toBeNull();
    });
});
