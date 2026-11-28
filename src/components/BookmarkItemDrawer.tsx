import { Drawer, DrawerContent, DrawerTitle } from "./ui/drawer";
import { type ReactNode, useEffect, useRef } from "react";
import type { Bookmark } from "../lib/bookmark";
import { cn } from "../lib/utils";
import { getBookmarkCardActions } from "./bookmarkCardActions";

interface BookmarkItemDrawerProps {
    archived: boolean;
    bookmark: Bookmark;
    onEdit: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    readerMode: boolean;
}

const BookmarkItemDrawer = ({
    archived,
    bookmark,
    onEdit,
    onOpenChange,
    open,
    readerMode
}: BookmarkItemDrawerProps): ReactNode => {
    // A deferred action belongs to the close that follows its click; a fresh open discards one
    // whose close never completed.
    const deferredAction = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (open) {
            deferredAction.current = null;
        }
    }, [open]);

    const finishClosing = (nextOpen: boolean): void => {
        if (nextOpen || !deferredAction.current) {
            return;
        }

        const action = deferredAction.current;
        deferredAction.current = null;
        action();
    };

    return (
        <Drawer onOpenChange={onOpenChange} onOpenChangeComplete={finishClosing} open={open} showSwipeHandle>
            <DrawerContent>
                <DrawerTitle className="sr-only">{bookmark.title}</DrawerTitle>
                <ul className="py-2">
                    {getBookmarkCardActions({
                        archived,
                        bookmark,
                        onEdit,
                        readerMode
                    }).map(({ deferUntilClosed, icon: Icon, label, onSelect, variant }) => (
                        <li key={label}>
                            <button
                                className={cn(
                                    "flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted",
                                    variant === "destructive" && "text-destructive hover:bg-destructive/10"
                                )}
                                onClick={() => {
                                    if (deferUntilClosed) {
                                        deferredAction.current = onSelect;
                                    } else {
                                        onSelect();
                                    }

                                    onOpenChange(false);
                                }}
                                type="button"
                            >
                                <Icon aria-hidden="true" className="size-4" />
                                {label}
                            </button>
                        </li>
                    ))}
                </ul>
            </DrawerContent>
        </Drawer>
    );
};

export { BookmarkItemDrawer };
