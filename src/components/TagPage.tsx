import { BookmarkList } from "./BookmarkList";
import type { ReactNode } from "react";
import { useBookmarkList } from "../hooks/useBookmarkList";
import { useParams } from "@tanstack/react-router";
import { useSearchContext } from "../hooks/useSearch";
import { useTranslation } from "react-i18next";

const TagPage = (): ReactNode => {
    const { tag } = useParams({ from: "/tags/$tag" });
    const search = useSearchContext();
    const list = useBookmarkList({ query: search.query, scope: "active", tag }, search.finishSearch);
    const { t: translate } = useTranslation();

    return (
        <>
            {/* The mobile header carries the page title, so the in-page h1 shows on desktop only. */}
            <h1 className="hidden text-xl font-semibold md:block">{tag}</h1>
            <BookmarkList
                archived={false}
                bookmarks={list.bookmarks}
                emptyMessage={translate("bookmark.emptyTag", { tag })}
                listLabel={translate("bookmark.listTag", { tag })}
                loadState={list.loadState}
                onRetry={list.retry}
                query={search.query}
            />
        </>
    );
};

export { TagPage };
