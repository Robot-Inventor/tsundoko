import dns from "node:dns/promises";
import { loadXeet } from "@xeet/core/node";

const xPostHostnames = new Set(["mobile.twitter.com", "mobile.x.com", "twitter.com", "x.com"]);
const renderWidth = 390;
const renderDpr = 2;
const maxXPostTitleLength = 100;
const maxThumbnailBytes = 5_242_880;

// Matches post detail pages such as /user/status/123 and /i/status/123, including their /photo and /video variants.
// URL parsing lowercases the hostname already, so no case handling is needed here.
const isXPostUrl = (url: URL): boolean =>
    xPostHostnames.has(url.hostname) && url.pathname.split("/").includes("status");

const titleSegmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

// Grapheme-aware head so the cut point never splits a surrogate pair or a ZWJ emoji sequence.
const firstGraphemes = (text: string, length: number): string =>
    Array.from(titleSegmenter.segment(text), (segment) => segment.segment)
        // oxlint-disable-next-line no-magic-numbers -- Keep the first `length` graphemes.
        .slice(0, length)
        .join("");

interface XPostThumbnail {
    png: Uint8Array;
    siteName: string;
    title: string | null;
}

const renderXPost = async (url: URL): Promise<XPostThumbnail> => {
    const xeet = await loadXeet();
    // The lookup callback enables the resolver's DNS-hop SSRF guard for user-supplied URLs.
    const host = xeet.whatwgHost({ lookup: (hostname) => dns.resolve(hostname) });
    const { post } = await xeet.resolve(
        url.href,
        {
            dpr: renderDpr,
            media: true,
            width: renderWidth
        },
        host
    );

    const { png } = xeet.render(post, {
        dpr: renderDpr,
        theme: "dark",
        width: renderWidth
    });

    if (png.byteLength > maxThumbnailBytes) {
        throw new Error("Rendered X post thumbnail exceeded its size limit");
    }

    const text = post.text.trim();

    return {
        png,
        siteName: post.author?.handle ? `X（@${post.author.handle}）` : "X",
        title: text ? firstGraphemes(text, maxXPostTitleLength) : null
    };
};

export { type XPostThumbnail, isXPostUrl, renderXPost };
