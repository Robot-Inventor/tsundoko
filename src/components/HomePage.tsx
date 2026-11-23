import { AddBookmarkDialog } from "./AddBookmarkDialog";
import type { Bookmark } from "../lib/bookmark";
import { BookmarkList } from "./BookmarkList";
import type { ReactNode } from "react";
import { useBookmarkList } from "../hooks/useBookmarkList";
import { useSearchContext } from "../hooks/useSearch";

const HomePage = (): ReactNode => {
    const search = useSearchContext();
    const list = useBookmarkList("active", search.query);

    return (
        <>
            {/* The wrapper must stay rendered on mobile: AddBookmarkDialog's floating button lives here. */}
            <div className="flex items-center justify-between gap-2">
                {/* The mobile header carries the page title, so the in-page h1 shows on desktop only. */}
                <h1 className="hidden text-xl font-semibold md:block">ホーム</h1>
                <AddBookmarkDialog
                    onAdd={(bookmark: Bookmark) => {
                        search.clearSearch();
                        list.addBookmark(bookmark);
                    }}
                />
            </div>
            <BookmarkList
                archived={false}
                bookmarks={list.bookmarks}
                emptyMessage="まだブックマークがありません。"
                listLabel="追加したブックマーク"
                loadState={list.loadState}
                onRetry={list.retry}
                query={search.query}
            />
        </>
    );
};

export { HomePage };
