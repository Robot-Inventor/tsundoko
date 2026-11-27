import { httpStatus } from "./httpStatus";

interface BookmarkPreview {
    description: string | null;
    faviconUrl: string | null;
    siteName: string;
    thumbnailUrl: string | null;
    title: string;
    url: string;
}

// The client payload carries no server-internal file path; the card works from the thumbnailFit flag.
interface SavedBookmark extends BookmarkPreview {
    addedAt: string;
    id: string;
    tags: string[];
    // "top" for rendered X posts: tall screenshots are cropped from the top in the card.
    thumbnailFit: "top" | "center";
}

interface Bookmark extends Omit<SavedBookmark, "addedAt"> {
    addedAt: Date;
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
