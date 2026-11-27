import type { Bookmark } from "../lib/bookmark";
import { BookmarkCardSkeleton } from "./BookmarkCardSkeleton";
import { BookmarkListItem } from "./BookmarkListItem";
import { Button } from "./ui/button";
import type { LoadState } from "../hooks/useBookmarkList";
import type { ReactNode } from "react";
import type { SortBy } from "../lib/bookmarkSort";
import { useTranslation } from "react-i18next";

// Rows are full-bleed on mobile so the swipe gesture, the sliding card, and the reveal
// background span the screen edges. The vertical half of the row gap rides on the cards
// themselves (BookmarkListItem's max-sm:py-3), so the base gap is horizontal-only;
// max-sm:-mt-3 cancels the first row's top padding strip and max-sm:-mb-3 the last
// row's bottom strip, so the list starts and ends flush with the card edges. The grids
// carry data-swipe-zone so the menu gesture also treats the gutters as part of the rows.
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
    sortBy: SortBy | null;
}

const BookmarkList = ({
    archived,
    bookmarks,
    emptyMessage,
    listLabel,
    loadState,
    onRetry,
    query,
    sortBy
}: BookmarkListProps): ReactNode => {
    const { t: translate } = useTranslation();

    // Search keeps relevance order and hides the sort menu, so only a plain published-date list
    // swaps the card's added date for the publication date.
    const showPublishedDate = !query && (sortBy === "publishedNewest" || sortBy === "publishedOldest");

    if (loadState === "loading" && !bookmarks.length) {
        return (
            <>
                <p className="sr-only" role="status">
                    {translate("bookmark.loading")}
                </p>
                <div aria-hidden="true" className={bookmarkGrid} data-swipe-zone>
                    {Array.from({ length: skeletonCount }, (_bookmark, index) => (
                        // The wrapper carries the same mobile swipe margins as a real item's card.
                        <div className="h-full min-w-0 max-sm:px-4 max-sm:py-3" key={index}>
                            <BookmarkCardSkeleton />
                        </div>
                    ))}
                </div>
            </>
        );
    }

    if (loadState === "ready" && !bookmarks.length) {
        return (
            <p className="mt-3 text-sm text-muted-foreground">
                {query ? translate("bookmark.noResults") : emptyMessage}
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
                        {translate("errors.bookmark.loadFailed")}
                    </p>
                    <Button onClick={onRetry} size="sm" type="button" variant="outline">
                        {translate("common.retry")}
                    </Button>
                </div>
            )}
            {Boolean(bookmarks.length) && (
                <ul
                    aria-label={query ? translate("bookmark.searchResults") : listLabel}
                    className={bookmarkGrid}
                    data-swipe-zone
                >
                    {bookmarks.map((bookmark) => (
                        <BookmarkListItem
                            archived={archived}
                            bookmark={bookmark}
                            key={bookmark.id}
                            showPublishedDate={showPublishedDate}
                        />
                    ))}
                </ul>
            )}
        </>
    );
};

export { BookmarkList };
