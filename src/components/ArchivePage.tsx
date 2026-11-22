import { BookmarkList } from "./BookmarkList";
import type { ReactNode } from "react";
import { useBookmarkList } from "../hooks/useBookmarkList";
import { useSearchContext } from "../hooks/useSearch";

const ArchivePage = (): ReactNode => {
    const search = useSearchContext();
    const list = useBookmarkList("archived", search.query);

    return (
        <>
            <h1 className="text-xl font-semibold">アーカイブ</h1>
            <BookmarkList
                archived
                bookmarks={list.bookmarks}
                emptyMessage="アーカイブされたブックマークはありません。"
                listLabel="アーカイブされたブックマーク"
                loadState={list.loadState}
                onRetry={list.retry}
                query={search.query}
            />
        </>
    );
};

export { ArchivePage };
