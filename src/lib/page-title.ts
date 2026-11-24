const brand = "Tsundoko";

const pages = {
    "/": {
        label: "ホーム",
        searchLabel: "ブックマークを検索"
    },
    "/archive": {
        label: "アーカイブ",
        searchLabel: "アーカイブを検索"
    },
    "/settings": {
        label: "設定"
    }
} as const;

type Page = (typeof pages)[keyof typeof pages];

const getPage = (pathname: string): Page => {
    if (pathname.startsWith("/archive")) {
        return pages["/archive"];
    }

    return pathname.startsWith("/settings") ? pages["/settings"] : pages["/"];
};

// Only pages with a bookmark list define a search label; the home label covers any future page that
// stays searchable without listing bookmarks itself.
const getSearchLabel = (pathname: string): string => {
    const page = getPage(pathname);

    return "searchLabel" in page ? page.searchLabel : pages["/"].searchLabel;
};

const getPageTitle = (label: string): string => `${label} | ${brand}`;

export { brand, getPage, getPageTitle, getSearchLabel, pages };
