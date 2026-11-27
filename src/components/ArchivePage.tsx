import { AddBookmarkDialog } from "./AddBookmarkDialog";
import { BookmarkList } from "./BookmarkList";
import { BookmarkSortMenu } from "./BookmarkSortMenu";
import type { ReactNode } from "react";
import { defaultSortBy } from "../lib/bookmarkSort";
import { useAccountContext } from "../hooks/useAccount";
import { useBookmarkList } from "../hooks/useBookmarkList";
import { useNavigate } from "@tanstack/react-router";
import { useSearchContext } from "../hooks/useSearch";
import { useTranslation } from "react-i18next";

const ArchivePage = (): ReactNode => {
    const search = useSearchContext();
    const { account, failed } = useAccountContext();
    const sortBy = account?.sortByArchived ?? (failed ? defaultSortBy : null);
    const list = useBookmarkList({
        onSettled: search.finishLoading,
        onSortStart: search.startListLoading,
        query: search.query,
        scope: "archived",
        sortBy
    });

    const navigate = useNavigate();
    const { t: translate } = useTranslation();

    return (
        <>
            {/* The wrapper must stay rendered on mobile: AddBookmarkDialog's floating button lives here. */}
            <div className="flex items-center justify-between gap-2">
                {/* The mobile header carries the page title, so the in-page h1 shows on desktop only. */}
                <div className="flex items-center gap-4">
                    <h1 className="hidden text-xl font-semibold md:block">{translate("page.archive")}</h1>
                    <AddBookmarkDialog
                        onAdd={() => {
                            // A new bookmark lands in the active list, so show it by moving to Home.
                            search.clearSearch();
                            void navigate({ to: "/" });
                        }}
                    />
                </div>
                {!search.query && <BookmarkSortMenu className="hidden md:inline-flex" scope="archived" />}
            </div>
            {!search.query && (
                <div className="mt-4 flex justify-end md:hidden">
                    <BookmarkSortMenu scope="archived" />
                </div>
            )}
            <BookmarkList
                archived
                bookmarks={list.bookmarks}
                emptyMessage={translate("bookmark.emptyArchive")}
                listLabel={translate("bookmark.listArchive")}
                loadState={list.loadState}
                onRetry={list.retry}
                query={search.query}
                sortBy={sortBy}
            />
        </>
    );
};

export { ArchivePage };
