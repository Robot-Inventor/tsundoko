import { type Bookmark, bookmarkMessages } from "../lib/bookmark";
import { BookmarkListItem } from "./BookmarkListItem";
import { Button } from "./ui/button";
import type { LoadState } from "../hooks/useBookmarkList";
import type { ReactNode } from "react";
import { Skeleton } from "./ui/skeleton";

// Full-bleed on mobile: -mx-4 cancels main's p-4 so swipe backgrounds reach the screen edges.
const bookmarkGrid = "mt-6 grid -mx-4 grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-6 sm:mx-0 sm:gap-4";

const skeletonCount = 6;

interface BookmarkListProps {
    archived: boolean;
    bookmarks: Bookmark[];
    emptyMessage: string;
    listLabel: string;
    loadState: LoadState;
    onRetry: () => void;
    query: string;
}

const BookmarkList = ({
    archived,
    bookmarks,
    emptyMessage,
    listLabel,
    loadState,
    onRetry,
    query
}: BookmarkListProps): ReactNode => {
    if (loadState === "loading" && !bookmarks.length) {
        return (
            <>
                <p className="sr-only" role="status">
                    ブックマークを読み込んでいます。
                </p>
                <div aria-hidden="true" className={bookmarkGrid}>
                    {Array.from({ length: skeletonCount }, (_bookmark, index) => (
                        <Skeleton className="h-21 rounded-lg sm:h-64 sm:rounded-xl" key={index} />
                    ))}
                </div>
            </>
        );
    }

    if (loadState === "ready" && !bookmarks.length) {
        return (
            <p className="mt-3 text-sm text-muted-foreground">
                {query ? "該当するブックマークがありません。" : emptyMessage}
            </p>
        );
    }

    return (
        <>
            {loadState === "error" && (
                <div className="mt-3 flex items-center gap-2">
                    <p className="text-sm text-muted-foreground" role="alert">
                        {bookmarkMessages.loadFailed}
                    </p>
                    <Button onClick={onRetry} size="sm" type="button" variant="outline">
                        再試行
                    </Button>
                </div>
            )}
            {Boolean(bookmarks.length) && (
                <ul aria-label={query ? "検索結果" : listLabel} className={bookmarkGrid}>
                    {bookmarks.map((bookmark) => (
                        <BookmarkListItem archived={archived} bookmark={bookmark} key={bookmark.id} />
                    ))}
                </ul>
            )}
        </>
    );
};

export { BookmarkList };
