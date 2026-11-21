import { type Bookmark, BookmarkCard } from "./BookmarkCard";
import { useEffect, useState } from "react";
import { BookmarkForm } from "./BookmarkForm";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { bookmarkClient } from "../lib/bookmarkClient";
import { bookmarkMessages } from "../lib/bookmark";

type LoadState = "error" | "loading" | "ready";

const bookmarkGrid = "mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4";
const skeletonCount = 6;

interface BookmarkListProps {
    bookmarks: Bookmark[];
    loadState: LoadState;
    onRetry: () => void;
    query: string;
}

const BookmarkList = ({ bookmarks, loadState, onRetry, query }: BookmarkListProps): React.JSX.Element => {
    if (loadState === "loading" && !bookmarks.length) {
        return (
            <>
                <p className="sr-only" role="status">
                    ブックマークを読み込んでいます。
                </p>
                <div aria-hidden="true" className={bookmarkGrid}>
                    {Array.from({ length: skeletonCount }, (_bookmark, index) => (
                        <Skeleton className="h-64 rounded-xl" key={index} />
                    ))}
                </div>
            </>
        );
    }

    if (loadState === "ready" && !bookmarks.length) {
        return (
            <p className="mt-3 text-sm text-muted-foreground">
                {query ? "該当するブックマークがありません。" : "まだブックマークがありません。"}
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
                <ul aria-label={query ? "検索結果" : "追加したブックマーク"} className={bookmarkGrid}>
                    {bookmarks.map((bookmark) => (
                        <li className="min-w-0" key={bookmark.id}>
                            <BookmarkCard bookmark={bookmark} />
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
};

interface BookmarkHomeProps {
    onSearchClear: () => void;
    query: string;
}

const BookmarkHome = ({ onSearchClear, query }: BookmarkHomeProps): React.JSX.Element => {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [reload, setReload] = useState(false);

    useEffect(() => {
        const request = {
            cancelled: false
        };

        void (async (): Promise<void> => {
            try {
                const response = await bookmarkClient.api.bookmarks.$get({
                    query: {
                        // oxlint-disable-next-line id-length -- "q" is the search parameter name defined by the API.
                        q: query
                    }
                });

                if (!response.ok) {
                    if (!request.cancelled) {
                        setLoadState("error");
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
                }
            } catch {
                if (!request.cancelled) {
                    setLoadState("error");
                }
            }
        })();

        return (): void => {
            request.cancelled = true;
        };
    }, [query, reload]);

    return (
        <>
            <BookmarkForm
                onAdd={(bookmark) => {
                    onSearchClear();
                    setBookmarks((current) => [bookmark, ...current]);
                }}
            />
            <BookmarkList
                bookmarks={bookmarks}
                loadState={loadState}
                onRetry={() => {
                    setLoadState("loading");
                    setReload((current) => !current);
                }}
                query={query}
            />
        </>
    );
};

export { BookmarkHome };
