import { jsonLdDatePublished } from "./jsonLdDate";

// Only the date fields open-graph-scraper already puts in its result; no extra HTML parsing.
interface DateScrapeResult {
    articlePublishedTime?: string;
    jsonLD?: object[];
    ogDate?: string;
}

const firstText = (...values: Array<string | null | undefined>): string | null => {
    for (const value of values) {
        const trimmed = value?.trim();

        if (trimmed) {
            return trimmed;
        }
    }

    return null;
};

// OGP's article time wins; schema.org JSON-LD is next, and the scraper's date fallback is last.
// An unparseable value is treated as no date rather than failing the bookmark.
const extractPublishedDate = (result: DateScrapeResult): Date | null => {
    const raw =
        firstText(result.articlePublishedTime) ?? jsonLdDatePublished(result.jsonLD) ?? firstText(result.ogDate);

    if (!raw) {
        return null;
    }

    const parsed = new Date(raw);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export { extractPublishedDate };
