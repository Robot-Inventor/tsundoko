import { type PreviewData, getPreview } from "./preview";
import { type XPostThumbnail, isXPostUrl, renderXPost } from "./xPost";
import { cacheRemoteFavicon, cacheRemoteThumbnail, cacheRenderedThumbnail, readFavicon } from "./imageCache";
import { runImageOutbound, runOutbound } from "./outboundLimit";

interface BookmarkImageSources {
    faviconUrl: string | null;
    hostname: string;
    id: string;
    thumbnailUrl: string | null;
}

// Both fetches are best-effort: a failure leaves that image for the request path to fill, so the
// bookmark itself is still saved and returned.
const warmImageCache = async (
    userId: string,
    sources: BookmarkImageSources,
    xPostPng: Uint8Array | null
): Promise<void> => {
    // The favicon is shared by every bookmark on the host, so an already cached icon is kept
    // instead of rewriting it with whatever this page happens to advertise.
    const cachedFavicon = await readFavicon(sources.hostname);

    await Promise.all([
        runImageOutbound(userId, () => {
            if (xPostPng) {
                return cacheRenderedThumbnail(sources.id, xPostPng);
            }

            return sources.thumbnailUrl
                ? cacheRemoteThumbnail(sources.id, sources.thumbnailUrl)
                : Promise.resolve(null);
        }).catch(() => null),
        cachedFavicon
            ? Promise.resolve(null)
            : runImageOutbound(userId, () => cacheRemoteFavicon(sources.hostname, sources.faviconUrl)).catch(() => null)
    ]);
};

interface FetchedPreview {
    preview: PreviewData | null;
    url: URL;
    xPost: XPostThumbnail | null;
}

// X post pages are fetched by xeet instead of the OG pipeline, so both are tried independently:
// either one succeeding is enough to save the bookmark, and the OG result fills the rest.
// The page fetch also reports its redirect target, which is the URL the save path normalises.
const fetchPreview = async (userId: string, url: URL): Promise<FetchedPreview> => {
    const [xPost, fetchedPage] = await Promise.all([
        isXPostUrl(url)
            ? runOutbound(userId, () => renderXPost(url)).catch((error: unknown) => {
                  // A busy pool and a failed render both degrade to the OG result.
                  // oxlint-disable-next-line no-console -- Server-side diagnostics are console's legitimate use.
                  console.warn("X post thumbnail rendering failed:", error);

                  return null;
              })
            : null,
        runOutbound(userId, () => getPreview(url)).catch(() => null)
    ]);

    return {
        preview: fetchedPage?.preview ?? null,
        url: fetchedPage?.pageUrl ?? url,
        xPost
    };
};

export { fetchPreview, warmImageCache };
