import type { Bookmark, BookmarkScope } from "../lib/bookmark";
import { applyPendingActions, usePendingBookmarkActions } from "../lib/bookmarkActions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { bookmarkClient } from "../lib/bookmarkClient";

type LoadState = "error" | "loading" | "ready";

interface UseBookmarkListResult {
    addBookmark: (bookmark: Bookmark) => void;
    bookmarks: Bookmark[];
    loadState: LoadState;
    retry: () => void;
}

// onSettled must be stable: it is part of the fetch effect's dependencies.
const useBookmarkList = (scope: BookmarkScope, query: string, onSettled?: () => void): UseBookmarkListResult => {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [reload, setReload] = useState(false);
    const pendingActions = usePendingBookmarkActions();

    useEffect(() => {
        const request = {
            cancelled: false
        };

        void (async (): Promise<void> => {
            try {
                const response = await bookmarkClient.api.bookmarks.$get({
                    query: {
                        // oxlint-disable-next-line id-length -- "q" is the search parameter name defined by the API.
                        q: query,
                        scope
                    }
                });

                if (!response.ok) {
                    if (!request.cancelled) {
                        setLoadState("error");
                        onSettled?.();
                    }

                    return;
                }

                const loaded = (await response.json()).map((bookmark) => ({
                    ...bookmark,
                    addedAt: new Date(bookmark.addedAt)
                }));

                if (!request.cancelled) {
                    setBookmarks((current) => {
                        // Search results must replace the list; merging would keep bookmarks that no longer match.
                        if (query) {
                            return loaded;
                        }

                        const loadedIds = new Set(loaded.map((bookmark) => bookmark.id));

                        return [...current.filter((bookmark) => !loadedIds.has(bookmark.id)), ...loaded];
                    });

                    setLoadState("ready");
                    onSettled?.();
                }
            } catch {
                if (!request.cancelled) {
                    setLoadState("error");
                    onSettled?.();
                }
            }
        })();

        return (): void => {
            request.cancelled = true;
        };
    }, [onSettled, query, reload, scope]);

    const displayedBookmarks = useMemo(
        () => applyPendingActions(bookmarks, pendingActions, scope),
        [bookmarks, pendingActions, scope]
    );

    const addBookmark = useCallback((bookmark: Bookmark): void => {
        setBookmarks((current) => [bookmark, ...current]);
    }, []);

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
