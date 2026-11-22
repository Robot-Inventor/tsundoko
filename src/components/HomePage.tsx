import type { Bookmark } from "../lib/bookmark";
import { BookmarkForm } from "./BookmarkForm";
import { BookmarkList } from "./BookmarkList";
import type { ReactNode } from "react";
import { useBookmarkList } from "../hooks/useBookmarkList";
import { useSearchContext } from "../hooks/useSearch";

const HomePage = (): ReactNode => {
    const search = useSearchContext();
    const list = useBookmarkList("active", search.query);

    return (
        <>
            <h1 className="text-xl font-semibold">ホーム</h1>
            <BookmarkForm
                onAdd={(bookmark: Bookmark) => {
                    search.clearSearch();
                    list.addBookmark(bookmark);
                }}
            />
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
