const brand = "Tsundoko";

const pages = {
    "/": {
        label: "ホーム",
        searchLabel: "ブックマークを検索"
    },
    "/archive": {
        label: "アーカイブ",
        searchLabel: "アーカイブを検索"
    }
} as const;

type Page = (typeof pages)[keyof typeof pages];

const getPage = (pathname: string): Page => (pathname.startsWith("/archive") ? pages["/archive"] : pages["/"]);

const getPageTitle = (label: string): string => `${label} | ${brand}`;

export { brand, getPage, getPageTitle, pages };
