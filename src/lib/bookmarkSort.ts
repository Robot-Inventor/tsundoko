import type { Bookmark } from "./bookmark";

const sortByValues = ["newest", "oldest", "publishedNewest", "publishedOldest", "titleAsc", "titleDesc"] as const;

type SortBy = (typeof sortByValues)[number];

const defaultSortBy: SortBy = "newest";
const noMatch = -1;
const sortsBefore = -1;
const sortsAfter = 1;

// Unknown values come from stale clients or hand-written URLs; they must not break the list.
const parseSortBy = (value?: unknown): SortBy => sortByValues.find((candidate) => candidate === value) ?? defaultSortBy;

const byAddedDesc = (left: Bookmark, right: Bookmark): number =>
    right.addedAt.getTime() - left.addedAt.getTime() || right.id.localeCompare(left.id);

// A missing publication date sorts as the oldest one: first ascending, last descending.
const comparePublished = (left: Bookmark, right: Bookmark, newestFirst: boolean): number => {
    const leftTime = left.publishedAt?.getTime() ?? null;
    const rightTime = right.publishedAt?.getTime() ?? null;

    if (leftTime === null || rightTime === null) {
        if (leftTime === rightTime) {
            return byAddedDesc(left, right);
        }

        return newestFirst === (leftTime === null) ? sortsAfter : sortsBefore;
    }

    const difference = newestFirst ? rightTime - leftTime : leftTime - rightTime;

    return difference || byAddedDesc(left, right);
};

// Optimistic additions must land where the server would put them, not always at the top.
// The tails mirror the SQL ORDER BY in db/bookmarks.ts.
const compareBySortBy = (left: Bookmark, right: Bookmark, sortBy: SortBy): number => {
    switch (sortBy) {
        case "newest":
            return right.addedAt.getTime() - left.addedAt.getTime() || right.id.localeCompare(left.id);
        case "oldest":
            return left.addedAt.getTime() - right.addedAt.getTime() || left.id.localeCompare(right.id);
        case "publishedNewest":
            return comparePublished(left, right, true);
        case "publishedOldest":
            return comparePublished(left, right, false);
        case "titleAsc":
            return (
                left.title.localeCompare(right.title, "ja") ||
                left.addedAt.getTime() - right.addedAt.getTime() ||
                right.id.localeCompare(left.id)
            );
        case "titleDesc":
            return (
                right.title.localeCompare(left.title, "ja") ||
                left.addedAt.getTime() - right.addedAt.getTime() ||
                right.id.localeCompare(left.id)
            );
        default:
            return right.addedAt.getTime() - left.addedAt.getTime() || right.id.localeCompare(left.id);
    }
};

const insertBySortBy = (bookmarks: Bookmark[], bookmark: Bookmark, sortBy: SortBy): Bookmark[] => {
    // oxlint-disable-next-line no-magic-numbers
    const index = bookmarks.findIndex((existing) => compareBySortBy(bookmark, existing, sortBy) < 0);
    const next = [...bookmarks];

    // oxlint-disable-next-line no-magic-numbers
    next.splice(index === noMatch ? next.length : index, 0, bookmark);

    return next;
};

export { defaultSortBy, insertBySortBy, parseSortBy, type SortBy, sortByValues };
