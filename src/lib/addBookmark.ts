import { type Bookmark, httpStatus } from "./bookmark";
import { bookmarkClient } from "./bookmarkClient";

type AddBookmarkFailure = "duplicate" | "fetch" | "invalid" | "save";

type AddBookmarkResult = { bookmark: Bookmark } | { failure: AddBookmarkFailure };

const failureByStatus: Partial<Record<number, AddBookmarkFailure>> = {
    [httpStatus.badGateway]: "fetch",
    [httpStatus.badRequest]: "invalid",
    [httpStatus.conflict]: "duplicate"
};

const requestBookmark = async (url: URL): Promise<AddBookmarkResult> => {
    try {
        const response = await bookmarkClient.api.bookmarks.$post({
            json: {
                url: url.href
            }
        });

        if (response.ok) {
            const saved = await response.json();

            return {
                bookmark: {
                    ...saved,
                    addedAt: new Date(saved.addedAt)
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
