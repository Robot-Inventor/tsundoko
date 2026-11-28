import { type Bookmark, httpStatus } from "./bookmark";
import { bookmarkClient } from "./bookmarkClient";

type AddBookmarkFailure = "auth" | "duplicate" | "fetch" | "invalid" | "rateLimit" | "save";

type AddBookmarkResult = { bookmark: Bookmark } | { failure: AddBookmarkFailure };

const failureByStatus: Partial<Record<number, AddBookmarkFailure>> = {
    [httpStatus.badGateway]: "fetch",
    [httpStatus.badRequest]: "invalid",
    [httpStatus.conflict]: "duplicate",
    [httpStatus.forbidden]: "auth",
    [httpStatus.tooManyRequests]: "rateLimit",
    [httpStatus.unauthorized]: "auth"
};

const requestBookmark = async (url: URL, tags: string[] = []): Promise<AddBookmarkResult> => {
    try {
        const response = await bookmarkClient.api.bookmarks.$post({
            json: {
                tags,
                url: url.href
            }
        });

        if (response.ok) {
            const saved = await response.json();

            return {
                bookmark: {
                    ...saved,
                    addedAt: new Date(saved.addedAt),
                    publishedAt: saved.publishedAt ? new Date(saved.publishedAt) : null
                }
            };
        }

        return {
            failure: failureByStatus[response.status] ?? "save"
        };
    } catch {
        return {
            failure: "save"
        };
    }
};

export { type AddBookmarkFailure, requestBookmark };
