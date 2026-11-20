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
    thumbnailUrl: string | null;
    title: string;
    url: string;
}

interface SavedBookmark extends BookmarkPreview {
    addedAt: string;
    id: string;
}

export { bookmarkMessages, type BookmarkPreview, type SavedBookmark };
