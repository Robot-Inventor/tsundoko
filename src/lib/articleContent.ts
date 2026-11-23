import { Readability, isProbablyReaderable } from "@mozilla/readability";
import rehypeSanitize, { type Options, defaultSchema } from "rehype-sanitize";
import { parseHTML } from "linkedom";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

// ~100 KB of Markdown is already far beyond useful search hits, and the cap keeps rows bounded.
const maxContentLength = 100_000;

// The GitHub-style defaults already drop script/style/iframe; the protocols list also
// keeps javascript: and data: URLs out, so the stored Markdown stays safe to search.
const sanitizeSchema: Options = {
    ...defaultSchema,
    protocols: {
        cite: ["http", "https", "mailto"],
        href: ["http", "https", "mailto"],
        src: ["http", "https", "mailto"]
    }
};

const htmlToMarkdown = unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeRemark)
    .use(remarkStringify);

// Extraction failure must never fail the bookmark itself: the OG preview is still saved,
// so every error from parsing, readability or conversion collapses to null here.
const extractArticleContent = async (html: string): Promise<string | null> => {
    try {
        const { document } = parseHTML(html);

        // The gate keeps fallback dumps (nav menus, meta-only pages) out of the search index:
        // only pages Readability itself considers articles get content stored.
        if (!isProbablyReaderable(document)) {
            return null;
        }

        const article = new Readability(document).parse();

        if (!article?.content) {
            return null;
        }

        const markdown = String(await htmlToMarkdown.process(article.content)).trim();

        // oxlint-disable-next-line no-magic-numbers -- Keep the first `maxContentLength` characters.
        return markdown ? markdown.slice(0, maxContentLength) : null;
    } catch {
        return null;
    }
};

export { extractArticleContent };
