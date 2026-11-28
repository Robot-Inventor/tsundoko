import { parseBookmarkUrl } from "./bookmarkUrl";
import { type } from "arktype";

const sharedContent = type({
    "text?": "string",
    "title?": "string",
    "url?": "string"
});

const shareContentFields = ["text", "title", "url"] as const satisfies ReadonlyArray<keyof SharedContent>;

const sharePath = "/share";

const isSharePath = (path: string): boolean => path.replace(/\/+$/u, "").toLowerCase() === sharePath;

const needsShareConfirmation = (site: string | undefined, marked: boolean): boolean => site === "cross-site" && !marked;

const pickSharedContent = (source: Record<string, unknown>): SharedContent => {
    const content: SharedContent = {};

    for (const key of shareContentFields) {
        const value = source[key];

        if (typeof value === "string") {
            content[key] = value;
        }
    }

    return content;
};

type SharedContent = typeof sharedContent.infer;

interface ShareRequest {
    requiresConfirmation: boolean;
    urls: string[];
}

// A share target launch is a browser-initiated navigation, so it has no referrer. A link from
// another site does; a same-origin referrer is trusted. A cross-origin page can suppress the
// referrer, which this check cannot see.
const isExternalReferrer = (referrer: string, origin: string): boolean =>
    Boolean(referrer) && new URL(referrer).origin !== origin;

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

// Android share intents have no URL field, so the browser puts the shared link in "text" and the
// page title in "title". A page title can carry links of its own (X puts the post text there, with
// a t.co link to every attachment), so only the first parameter that contains a URL is read:
// "url" when the browser provides it, otherwise "text", and "title" only when nothing else has
// one. Reading them all would bookmark the page's own links along with the shared one.
const extractSharedUrls = ({ text, title, url }: SharedContent): URL[] => {
    const seen = new Set<string>();

    return (
        [url, text, title]
            .map(urlsIn)
            .find((candidates) => candidates.length)
            ?.filter((candidate) => {
                if (seen.has(candidate.href)) {
                    return false;
                }

                seen.add(candidate.href);

                return true;
            }) ?? []
    );
};

export {
    extractSharedUrls,
    isExternalReferrer,
    isSharePath,
    needsShareConfirmation,
    pickSharedContent,
    sharedContent,
    type SharedContent,
    type ShareRequest
};
