import type { SavedBookmark } from "./bookmark";
import { bookmarkClient } from "./bookmarkClient";

type ReaderContent = SavedBookmark & { content: string | null };

// A missing or unreadable article is not a navigation error: the reader page shows the saved
// metadata and an offer to open the original link instead.
const loadReaderContent = async (id: string): Promise<ReaderContent | null> => {
    const response = await bookmarkClient.api.bookmarks[":id"].content.$get({
        param: {
            id
        }
    });

    return response.ok ? response.json() : null;
};

export { type ReaderContent, loadReaderContent };
