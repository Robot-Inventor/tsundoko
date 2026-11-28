import type { TFunction } from "i18next";

const pages = {
    "/": {
        label: "page.home",
        searchLabel: "page.homeSearch"
    },
    "/archive": {
        label: "page.archive",
        searchLabel: "page.archiveSearch"
    },
    "/login": {
        label: "auth.loginTitle"
    },
    "/reader": {
        label: "page.reader"
    },
    "/settings": {
        label: "page.settings"
    },
    "/share": {
        label: "bookmark.addTitle"
    },
    "/signup": {
        label: "auth.signupTitle"
    },
    "/tags": {
        label: "page.tags",
        searchLabel: "page.tagSearch"
    }
} as const;

type Page = (typeof pages)[keyof typeof pages];

const getPage = (pathname: string): Page => {
    if (pathname.startsWith("/archive")) {
        return pages["/archive"];
    }

    if (pathname.startsWith("/settings")) {
        return pages["/settings"];
    }

    if (pathname.startsWith("/login")) {
        return pages["/login"];
    }

    if (pathname.startsWith("/reader")) {
        return pages["/reader"];
    }

    if (pathname.startsWith("/signup")) {
        return pages["/signup"];
    }

    if (pathname.startsWith("/share")) {
        return pages["/share"];
    }

    if (pathname.startsWith("/tags")) {
        return pages["/tags"];
    }

    return pages["/"];
};

// Only pages with a bookmark list define a search label; the home label covers any future page that
// stays searchable without listing bookmarks itself.
const getSearchLabel = (pathname: string): string => {
    const page = getPage(pathname);

    return "searchLabel" in page ? page.searchLabel : pages["/"].searchLabel;
};

const getPageTitle = (label: string, translate: TFunction): string => translate("page.title", { page: label });

export { getPage, getPageTitle, getSearchLabel };
