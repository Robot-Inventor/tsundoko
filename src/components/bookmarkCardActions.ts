import { ArchiveIcon, ArchiveRestoreIcon, type LucideIcon, Trash2Icon } from "lucide-react";
import type { Bookmark } from "../lib/bookmark";
import { i18n } from "../lib/i18n";
import { requestBookmarkAction } from "../lib/bookmarkActions";

interface BookmarkCardAction {
    icon: LucideIcon;
    label: string;
    onSelect: () => void;
    variant?: "default" | "destructive";
}

// One definition drives both the desktop hover menu and the mobile long-press drawer,
// so adding an action to either one automatically adds it to the other.
const getBookmarkCardActions = (archived: boolean, bookmark: Bookmark): BookmarkCardAction[] => [
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
];

export { getBookmarkCardActions };
