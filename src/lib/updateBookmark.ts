import { type Bookmark, httpStatus } from "./bookmark";
import { bookmarkClient } from "./bookmarkClient";

type UpdateBookmarkFailure = "auth" | "invalid" | "notFound" | "rateLimit" | "save";

type UpdateBookmarkResult = { bookmark: Bookmark } | { failure: UpdateBookmarkFailure };

const failureByStatus: Partial<Record<number, UpdateBookmarkFailure>> = {
    [httpStatus.badRequest]: "invalid",
    [httpStatus.forbidden]: "auth",
    [httpStatus.notFound]: "notFound",
    [httpStatus.tooManyRequests]: "rateLimit",
    [httpStatus.unauthorized]: "auth"
};

interface UpdateBookmarkInput {
    id: string;
    tags: string[];
    title: string;
}

const requestBookmarkUpdate = async ({ id, tags, title }: UpdateBookmarkInput): Promise<UpdateBookmarkResult> => {
    try {
        const response = await bookmarkClient.api.bookmarks[":id"].$put({
            json: {
                tags,
                title
            },
            param: {
                id
            }
        });

        if (!response.ok) {
            return {
                failure: failureByStatus[response.status] ?? "save"
            };
        }

        const saved = await response.json();

        return {
            bookmark: {
                ...saved,
                addedAt: new Date(saved.addedAt),
                publishedAt: saved.publishedAt ? new Date(saved.publishedAt) : null
            }
        };
    } catch {
        return {
            failure: "save"
        };
    }
};

export { type UpdateBookmarkFailure, requestBookmarkUpdate };
