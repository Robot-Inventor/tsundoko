import { ArchiveIcon, ArchiveRestoreIcon, LinkIcon, type LucideIcon, ShareIcon, Trash2Icon } from "lucide-react";
import { notifyError, notifySuccess } from "../lib/appToast";
import type { Bookmark } from "../lib/bookmark";
import { i18n } from "../lib/i18n";
import { requestBookmarkAction } from "../lib/bookmarkActions";

interface BookmarkCardAction {
    icon: LucideIcon;
    label: string;
    onSelect: () => void;
    variant?: "default" | "destructive";
}

const copyBookmarkLink = async (bookmark: Bookmark): Promise<void> => {
    try {
        await navigator.clipboard.writeText(bookmark.url);
        notifySuccess(i18n.t("bookmark.linkCopied"));
    } catch {
        notifyError(i18n.t("bookmark.linkCopyFailed"));
    }
};

const shareBookmark = async (bookmark: Bookmark): Promise<void> => {
    try {
        await navigator.share({
            text: bookmark.title,
            title: bookmark.title,
            url: bookmark.url
        });
    } catch (error) {
        // The user dismissing the share sheet rejects with AbortError; nothing went wrong.
        if (error instanceof Error && error.name === "AbortError") {
            return;
        }

        notifyError(i18n.t("bookmark.shareFailed"));
    }
};

// One definition drives both the desktop hover menu and the mobile long-press drawer,
// so adding an action to either one automatically adds it to the other.
const getBookmarkCardActions = (archived: boolean, bookmark: Bookmark): BookmarkCardAction[] => {
    const actions: BookmarkCardAction[] = [
        {
            icon: LinkIcon,
            label: i18n.t("bookmark.actionCopyLink"),
            onSelect: (): void => {
                void copyBookmarkLink(bookmark);
            }
        }
    ];

    // Browsers without the Web Share API (most desktop ones) cannot share, so the item is
    // left out instead of showing an action that always fails.
    if (typeof navigator.share === "function") {
        actions.push({
            icon: ShareIcon,
            label: i18n.t("bookmark.actionShare"),
            onSelect: (): void => {
                void shareBookmark(bookmark);
            }
        });
    }

    actions.push(
        {
            icon: archived ? ArchiveRestoreIcon : ArchiveIcon,
            label: archived ? i18n.t("bookmark.actionUnarchive") : i18n.t("bookmark.actionArchive"),
            onSelect: (): void => {
                requestBookmarkAction(archived ? "unarchive" : "archive", bookmark);
            }
        },
        {
            icon: Trash2Icon,
            label: i18n.t("bookmark.actionDelete"),
            onSelect: (): void => {
                requestBookmarkAction("delete", bookmark);
            },
            variant: "destructive"
        }
    );

    return actions;
};

export { getBookmarkCardActions };
