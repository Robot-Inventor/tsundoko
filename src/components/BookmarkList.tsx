import { type Bookmark, bookmarkMessages } from "../lib/bookmark";
import { BookmarkListItem } from "./BookmarkListItem";
import { Button } from "./ui/button";
import type { LoadState } from "../hooks/useBookmarkList";
import type { ReactNode } from "react";
import { Skeleton } from "./ui/skeleton";

// Rows are full-bleed on mobile so the swipe gesture, the sliding card, and the reveal
// background span the screen edges. The vertical half of the row gap rides on the cards
// themselves (BookmarkListItem's max-sm:py-3), so the base gap is horizontal-only;
// max-sm:-mt-3 cancels the first row's top padding strip and max-sm:-mb-3 the last
// row's bottom strip, so the list starts and ends flush with the card edges.
const bookmarkGrid =
    "mt-6 max-sm:-mt-3 max-sm:-mb-3 grid max-sm:-mx-4 grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-x-6 sm:gap-4";

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
                        <Skeleton
                            className="h-21 max-sm:mx-4 max-sm:my-3 rounded-lg sm:h-64 sm:rounded-xl"
                            key={index}
                        />
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
                // max-sm:mb-3 offsets the grid's max-sm:-mt-3, which would otherwise seat
                // the first card flush against this banner's bottom edge.
                <div className="mt-3 max-sm:mb-3 flex items-center gap-2">
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
