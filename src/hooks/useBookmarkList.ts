import type { Bookmark, BookmarkScope } from "../lib/bookmark";
import { type SortBy, defaultSortBy, insertBySortBy } from "../lib/bookmarkSort";
import { applyPendingActions, usePendingBookmarkActions } from "../lib/bookmarkActions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bookmarkClient } from "../lib/bookmarkClient";

type LoadState = "error" | "loading" | "ready";

interface UseBookmarkListResult {
    addBookmark: (bookmark: Bookmark) => void;
    bookmarks: Bookmark[];
    loadState: LoadState;
    retry: () => void;
}

interface UseBookmarkListInput {
    onSettled?: () => void;
    // Runs only when a saved sort change triggers a refetch, not on the initial load.
    onSortStart?: () => void;
    query: string;
    scope: BookmarkScope;
    sortBy: SortBy | null;
}

const fetchBookmarks = async (query: string, scope: BookmarkScope, sortBy: SortBy): Promise<Bookmark[] | null> => {
    try {
        const response = await bookmarkClient.api.bookmarks.$get({
            query: {
                // oxlint-disable-next-line id-length -- "q" is the search parameter name defined by the API.
                q: query,
                scope,
                sortBy
            }
        });

        if (!response.ok) {
            return null;
        }

        return (await response.json()).map((bookmark) => ({
            ...bookmark,
            addedAt: new Date(bookmark.addedAt)
        }));
    } catch {
        return null;
    }
};

// onSettled and onSortStart must be stable: they are part of the fetch effect's dependencies.
const useBookmarkList = ({
    onSettled,
    onSortStart,
    query,
    scope,
    sortBy
}: UseBookmarkListInput): UseBookmarkListResult => {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [reload, setReload] = useState(false);
    const pendingActions = usePendingBookmarkActions();
    const previousSortBy = useRef(sortBy);

    useEffect(() => {
        // The account loads asynchronously; waiting avoids fetching the default order first.
        if (sortBy === null) {
            return;
        }

        // A changed sort order replaces the list; merging would keep the old positions on top.
        // The first settled value after the account loads is not a user-initiated sort change.
        const sortChanged = previousSortBy.current !== null && previousSortBy.current !== sortBy;
        previousSortBy.current = sortBy;

        if (sortChanged) {
            onSortStart?.();
        }

        const request = {
            cancelled: false
        };

        void (async (): Promise<void> => {
            const loaded = await fetchBookmarks(query, scope, sortBy);

            if (request.cancelled) {
                return;
            }

            if (!loaded) {
                setLoadState("error");
                onSettled?.();

                return;
            }

            setBookmarks((current) => {
                // Search results and a new sort order must replace the list; merging would
                // keep bookmarks that no longer match or that sit in the old positions.
                if (query || sortChanged) {
                    return loaded;
                }

                const loadedIds = new Set(loaded.map((bookmark) => bookmark.id));

                return [...current.filter((bookmark) => !loadedIds.has(bookmark.id)), ...loaded];
            });

            setLoadState("ready");
            onSettled?.();
        })();

        return (): void => {
            request.cancelled = true;
        };
    }, [onSettled, onSortStart, query, reload, scope, sortBy]);

    const displayedBookmarks = useMemo(
        () => applyPendingActions({ bookmarks, pending: pendingActions, scope, sortBy: sortBy ?? defaultSortBy }),
        [bookmarks, pendingActions, scope, sortBy]
    );

    const addBookmark = useCallback(
        (bookmark: Bookmark): void => {
            setBookmarks((current) => insertBySortBy(current, bookmark, sortBy ?? defaultSortBy));
        },
        [sortBy]
    );

    const retry = useCallback((): void => {
        setLoadState("loading");
        setReload((current) => !current);
    }, []);

    return {
        addBookmark,
        bookmarks: displayedBookmarks,
        loadState,
        retry
    };
};

export { type LoadState, useBookmarkList };
