// oxlint-disable import/max-dependencies -- The tag page wires the list, search, tags, and the add dialog.
import { AddBookmarkDialog } from "./AddBookmarkDialog";
import { BookmarkList } from "./BookmarkList";
import { BookmarkSortMenu } from "./BookmarkSortMenu";
import type { ReactNode } from "react";
import { defaultSortBy } from "../lib/bookmarkSort";
import { tagNameKey } from "../lib/tags";
import { useAccountContext } from "../hooks/useAccount";
import { useBookmarkList } from "../hooks/useBookmarkList";
import { useParams } from "@tanstack/react-router";
import { useSearchContext } from "../hooks/useSearch";
import { useTagListContext } from "../hooks/useTagList";
import { useTranslation } from "react-i18next";

const TagPage = (): ReactNode => {
    const { tag } = useParams({ from: "/tags/$tag" });
    const search = useSearchContext();
    const { account, failed } = useAccountContext();
    const tags = useTagListContext();
    const sortBy = account?.sortByActive ?? (failed ? defaultSortBy : null);
    const list = useBookmarkList({
        onSettled: search.finishLoading,
        onSortStart: search.startListLoading,
        query: search.query,
        scope: "active",
        sortBy,
        tag
    });

    const { t: translate } = useTranslation();

    return (
        <>
            {/* The wrapper must stay rendered on mobile: AddBookmarkDialog's floating button lives here. */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                    {/* The mobile header carries the page title, so the in-page h1 shows on desktop only. */}
                    <h1 className="hidden text-xl font-semibold md:block">{tag}</h1>
                    <AddBookmarkDialog
                        initialTag={tag}
                        onAdd={(bookmark) => {
                            search.clearSearch();
                            tags.reload();
                            // A removed tag means the bookmark does not belong in this filtered list.
                            if (bookmark.tags.some((name) => tagNameKey(name) === tagNameKey(tag))) {
                                list.addBookmark(bookmark);
                            }
                        }}
                    />
                </div>
                {!search.query && <BookmarkSortMenu scope="active" />}
            </div>
            <BookmarkList
                archived={false}
                bookmarks={list.bookmarks}
                emptyMessage={translate("bookmark.emptyTag", { tag })}
                listLabel={translate("bookmark.listTag", { tag })}
                loadState={list.loadState}
                onRetry={list.retry}
                query={search.query}
                sortBy={sortBy}
            />
        </>
    );
};

export { TagPage };
