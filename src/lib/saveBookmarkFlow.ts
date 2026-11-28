import { type SavedBookmark, httpStatus } from "./bookmark";
import { bookmarkExists, saveBookmark } from "../db/bookmarks";
import { fetchPreview, warmImageCache } from "./bookmarkPreview";
import { normalizeBookmarkUrl } from "./normalizeBookmarkUrl";
import { parseBookmarkUrl } from "./bookmarkUrl";

type SaveBookmarkOutcome =
    | { bookmark: SavedBookmark; status: "created" }
    | { status: "duplicate" | "fetchFailed" | "invalidUrl" | "saveFailed" };

interface SaveBookmarkRequest {
    tags: string[];
    url: string;
    userId: string;
}

// The REST route and the MCP add_bookmark tool share this pipeline so both apply the same URL
// normalisation, duplicate check, preview fetch, and image warming.
const saveBookmarkFromUrl = async ({ tags, url, userId }: SaveBookmarkRequest): Promise<SaveBookmarkOutcome> => {
    const parsed = parseBookmarkUrl(url);

    if (!parsed) {
        return {
            status: "invalidUrl"
        };
    }

    const submittedUrl = new URL(normalizeBookmarkUrl(parsed));

    try {
        if (await bookmarkExists(submittedUrl.href, userId)) {
            return {
                status: "duplicate"
            };
        }
    } catch {
        return {
            status: "saveFailed"
        };
    }

    const { preview, url: resolvedUrl, xPost } = await fetchPreview(userId, parsed);

    if (!preview && !xPost) {
        return {
            status: "fetchFailed"
        };
    }

    try {
        const saved = await saveBookmark({
            preview,
            tagNames: tags,
            url: new URL(normalizeBookmarkUrl(resolvedUrl)),
            userId,
            xPost
        });

        if (!saved) {
            return {
                status: "duplicate"
            };
        }

        await warmImageCache(
            userId,
            {
                faviconUrl: preview?.faviconUrl ?? null,
                hostname: new URL(saved.url).hostname,
                id: saved.id,
                thumbnailUrl: preview?.thumbnailUrl ?? null
            },
            xPost?.png ?? null
        );

        return {
            bookmark: saved,
            status: "created"
        };
    } catch {
        return {
            status: "saveFailed"
        };
    }
};

const saveBookmarkOutcomeStatus = {
    duplicate: httpStatus.conflict,
    fetchFailed: httpStatus.badGateway,
    invalidUrl: httpStatus.badRequest,
    saveFailed: httpStatus.internalServerError
} as const satisfies Record<Exclude<SaveBookmarkOutcome["status"], "created">, number>;

export { saveBookmarkFromUrl, saveBookmarkOutcomeStatus };
