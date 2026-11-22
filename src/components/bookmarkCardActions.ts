import { ArchiveIcon, ArchiveRestoreIcon, type LucideIcon, Trash2Icon } from "lucide-react";
import type { Bookmark } from "../lib/bookmark";
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
        label: archived ? "アーカイブから戻す" : "アーカイブ",
        onSelect: () => {
            requestBookmarkAction(archived ? "unarchive" : "archive", bookmark);
        }
    },
    {
        icon: Trash2Icon,
        label: "削除",
        onSelect: () => {
            requestBookmarkAction("delete", bookmark);
        },
        variant: "destructive"
    }
];

export { getBookmarkCardActions };
