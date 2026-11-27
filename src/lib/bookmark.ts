import { httpStatus } from "./httpStatus";

interface BookmarkPreview {
    description: string | null;
    faviconUrl: string | null;
    siteName: string;
    thumbnailFile: string | null;
    thumbnailUrl: string | null;
    title: string;
    url: string;
}

// The client payload carries no server-internal file path; the card works from the thumbnailFit flag.
interface SavedBookmark extends Omit<BookmarkPreview, "thumbnailFile"> {
    addedAt: string;
    id: string;
    // Null when the page did not expose a usable publication date.
    publishedAt: string | null;
    tags: string[];
    // "top" for locally stored renders: tall post screenshots are cropped from the top in the card.
    thumbnailFit: "top" | "center";
}

interface Bookmark extends Omit<SavedBookmark, "addedAt" | "publishedAt"> {
    addedAt: Date;
    publishedAt: Date | null;
}

type BookmarkScope = "active" | "archived";

interface BookmarkListFilter {
    query: string;
    scope: BookmarkScope;
    tag?: string;
}

// Re-exported so bookmark modules can use shared status codes without adding another import dependency.
export {
    type Bookmark,
    type BookmarkListFilter,
    type BookmarkPreview,
    type BookmarkScope,
    type SavedBookmark,
    httpStatus
};
