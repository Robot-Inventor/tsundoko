import { AddBookmarkDialog } from "./AddBookmarkDialog";
import { BookmarkList } from "./BookmarkList";
import { BookmarkSortMenu } from "./BookmarkSortMenu";
import type { ReactNode } from "react";
import { defaultSortBy } from "../lib/bookmarkSort";
import { useAccountContext } from "../hooks/useAccount";
import { useBookmarkList } from "../hooks/useBookmarkList";
import { useSearchContext } from "../hooks/useSearch";
import { useTagListContext } from "../hooks/useTagList";
import { useTranslation } from "react-i18next";

const HomePage = (): ReactNode => {
    const search = useSearchContext();
    const { account, failed } = useAccountContext();
    const tags = useTagListContext();
    const sortBy = account?.sortByActive ?? (failed ? defaultSortBy : null);
    const list = useBookmarkList({
        onSettled: search.finishLoading,
        onSortStart: search.startListLoading,
        query: search.query,
        scope: "active",
        sortBy
    });

    const { t: translate } = useTranslation();

    return (
        <>
            {/* The wrapper must stay rendered on mobile: AddBookmarkDialog's floating button lives here. */}
            <div className="flex items-center justify-between gap-2">
                {/* The mobile header carries the page title, so the in-page h1 shows on desktop only. */}
                <div className="flex items-center gap-4">
                    <h1 className="hidden text-xl font-semibold md:block">{translate("page.home")}</h1>
                    <AddBookmarkDialog
                        onAdd={(bookmark) => {
                            search.clearSearch();
                            tags.reload();
                            list.addBookmark(bookmark);
                        }}
                    />
                </div>
                {!search.query && <BookmarkSortMenu className="hidden md:inline-flex" scope="active" />}
            </div>
            {!search.query && (
                <div className="mt-4 flex justify-end md:hidden">
                    <BookmarkSortMenu scope="active" />
                </div>
            )}
            <BookmarkList
                archived={false}
                bookmarks={list.bookmarks}
                emptyMessage={translate("bookmark.emptyHome")}
                listLabel={translate("bookmark.listHome")}
                loadState={list.loadState}
                onRetry={list.retry}
                query={search.query}
                sortBy={sortBy}
            />
        </>
    );
};

export { HomePage };
