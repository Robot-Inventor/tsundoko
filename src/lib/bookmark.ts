const bookmarkMessages = {
    duplicate: "このURLはすでに追加されています。",
    fetchFailed: "ページの情報を取得できませんでした。URLを確認して再試行してください。",
    loadFailed: "ブックマークを読み込めませんでした。",
    saveFailed: "ブックマークを保存できませんでした。"
} as const;

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
    // "top" for locally stored renders: tall post screenshots are cropped from the top in the card.
    thumbnailFit: "top" | "center";
}

export { bookmarkMessages, type BookmarkPreview, type SavedBookmark };
