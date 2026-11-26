import { AddBookmarkDialog } from "./AddBookmarkDialog";
import type { Bookmark } from "../lib/bookmark";
import { BookmarkList } from "./BookmarkList";
import type { ReactNode } from "react";
import { useBookmarkList } from "../hooks/useBookmarkList";
import { useSearchContext } from "../hooks/useSearch";
import { useTagListContext } from "../hooks/useTagList";
import { useTranslation } from "react-i18next";

const HomePage = (): ReactNode => {
    const search = useSearchContext();
    const tags = useTagListContext();
    const list = useBookmarkList({ query: search.query, scope: "active" }, search.finishSearch);
    const { t: translate } = useTranslation();

    return (
        <>
            {/* The wrapper must stay rendered on mobile: AddBookmarkDialog's floating button lives here. */}
            <div className="flex items-center justify-between gap-2">
                {/* The mobile header carries the page title, so the in-page h1 shows on desktop only. */}
                <h1 className="hidden text-xl font-semibold md:block">{translate("page.home")}</h1>
                <AddBookmarkDialog
                    onAdd={(bookmark: Bookmark) => {
                        search.clearSearch();
                        tags.reload();
                        list.addBookmark(bookmark);
                    }}
                />
            </div>
            <BookmarkList
                archived={false}
                bookmarks={list.bookmarks}
                emptyMessage={translate("bookmark.emptyHome")}
                listLabel={translate("bookmark.listHome")}
                loadState={list.loadState}
                onRetry={list.retry}
                query={search.query}
            />
        </>
    );
};

export { HomePage };
