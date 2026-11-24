import { parseBookmarkUrl } from "./bookmarkUrl";
import { type } from "arktype";

const sharedContent = type({
    "text?": "string",
    "title?": "string",
    "url?": "string"
});

type SharedContent = typeof sharedContent.infer;

const urlInText = /https?:\/\/[^\s<>"'`]+/giu;

// Japanese prose can touch a URL without a space. Non-ASCII text is only prose in the host;
// a path such as `/wiki/日本語` is part of the URL. A host that starts with non-ASCII characters
// is an internationalized domain name, so only cut when the ASCII part is a complete host.
const authorityPattern = /^(?<head>https?:\/\/[^/?#]*)(?<tail>.*)$/iu;
const asciiAuthority = (candidate: string): string => {
    const parts = authorityPattern.exec(candidate);

    if (!parts?.groups) {
        return candidate;
    }

    const head = parts.groups["head"] ?? "";
    const tail = parts.groups["tail"] ?? "";
    const [asciiHead = ""] = head.split(/[^\x20-\x7E]/u);

    return asciiHead.replace(/^https?:\/\//iu, "").includes(".") ? `${asciiHead}${tail}` : candidate;
};

// Full-width closing punctuation belongs to the surrounding sentence. ASCII parentheses are
// left alone here because they may be part of the path.
const trailingPunctuation = /[.,;:!?、。'"”’）】》」』]+$/u;

// A URL wrapped in Markdown or prose brackets keeps its closer: `[記事](https://example.com)`
// and `(https://example.com)` both arrive with a ")" that has no "(" inside the match. A URL
// whose own path carries parentheses, such as `/wiki/Tsundoku_(disambiguation)`, is kept.
const trimUnbalancedParenthesis = (candidate: string): string =>
    candidate.endsWith(")") && !candidate.includes("(") ? candidate.replace(/\)$/u, "") : candidate;

const urlsIn = (value: string | undefined): URL[] => {
    if (!value) {
        return [];
    }

    return Array.from(value.matchAll(urlInText), (match) =>
        parseBookmarkUrl(trimUnbalancedParenthesis(asciiAuthority(match[0]).replace(trailingPunctuation, "")))
    ).filter((url): url is URL => url !== null);
};

const extractSharedUrls = ({ text, title, url }: SharedContent): URL[] => {
    const seen = new Set<string>();

    return [...urlsIn(url), ...urlsIn(text), ...urlsIn(title)].filter((candidate) => {
        if (seen.has(candidate.href)) {
            return false;
        }

        seen.add(candidate.href);

        return true;
    });
};

export { extractSharedUrls, sharedContent, type SharedContent };
