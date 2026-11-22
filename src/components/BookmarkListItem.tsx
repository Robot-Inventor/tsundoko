import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from "lucide-react";
import { type BookmarkActionKind, requestBookmarkAction } from "../lib/bookmarkActions";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "./ui/drawer";
import { type ReactNode, useRef, useState } from "react";
import type { Bookmark } from "../lib/bookmark";
import { BookmarkCard } from "./BookmarkCard";
import { cn } from "../lib/utils";
import { getBookmarkCardActions } from "./bookmarkCardActions";

// A swipe reveals the colored background in proportion to the finger travel; crossing
// 30% of the item width reveals the icon, releasing past it commits the action.
const swipeThresholdRatio = 0.3;
const exitAnimationMs = 200;
// Small movements are still taps and must keep opening the bookmark link.
const dragActivationPx = 8;
const longPressDurationMs = 500;
const restingOffsetPx = 0;
const touchPointerType = "touch";

interface SwipeStyle {
    backgroundClass: string;
    icon: typeof ArchiveIcon;
}

const swipeStyles: Record<BookmarkActionKind, SwipeStyle> = {
    archive: {
        backgroundClass: "bg-green-600",
        icon: ArchiveIcon
    },
    delete: {
        backgroundClass: "bg-destructive",
        icon: Trash2Icon
    },
    unarchive: {
        backgroundClass: "bg-green-600",
        icon: ArchiveRestoreIcon
    }
};

const clampOffset = (offset: number, width: number): number => Math.min(Math.max(offset, -width), width);

const resolvePendingAction = (offsetPx: number, archived: boolean): BookmarkActionKind | null => {
    if (offsetPx > restingOffsetPx) {
        return archived ? "unarchive" : "archive";
    }

    if (offsetPx < restingOffsetPx) {
        return "delete";
    }

    return null;
};

// Sends the action once the slide-out finished; the optimistic removal then unmounts the item.
const commitAfterSlideOut = (action: BookmarkActionKind, bookmark: Bookmark, resetToResting: () => void): void => {
    window.setTimeout(() => {
        requestBookmarkAction(action, bookmark);
        resetToResting();
    }, exitAnimationMs);
};

interface SwipeGesture {
    action: BookmarkActionKind | null;
    dragging: boolean;
    iconVisible: boolean;
    offsetPx: number;
    onContentClickCapture: (event: React.MouseEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerEnd: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
}

// A swipe that moved must not also activate the stretched bookmark link under the finger.
const createClickCaptureGuard =
    (suppressClick: React.RefObject<boolean>) =>
    (event: React.MouseEvent<HTMLDivElement>): void => {
        if (!suppressClick.current) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
    };

// oxlint-disable-next-line max-lines-per-function -- Swipe and long press share one gesture state machine on the same pointer stream.
const useSwipeToAction = (archived: boolean, bookmark: Bookmark, onLongPress: () => void): SwipeGesture => {
    const [offsetPx, setOffsetPx] = useState(restingOffsetPx);
    const [dragging, setDragging] = useState(false);
    const [iconVisible, setIconVisible] = useState(false);
    const [exitAction, setExitAction] = useState<BookmarkActionKind | null>(null);
    const gesture = useRef<{
        longPressTimer: number | null;
        moved: boolean;
        pointerId: number;
        startX: number;
    } | null>(null);

    const suppressClick = useRef(false);
    // oxlint-disable-next-line react/refs -- Only the ref object is passed on; it is never read during render.
    const onContentClickCapture = createClickCaptureGuard(suppressClick);

    const resetToResting = (): void => {
        setIconVisible(false);
        setOffsetPx(restingOffsetPx);
    };

    const releaseGesture = (): boolean => {
        const { current } = gesture;
        const wasDragging = current?.moved === true;

        if (current && current.longPressTimer !== null) {
            clearTimeout(current.longPressTimer);
        }

        gesture.current = null;
        setDragging(false);

        return wasDragging;
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
        // Touch-only gesture (pointer devices use the hover menu); clears the suppress flag a clickless drag may have left.
        if (event.pointerType !== touchPointerType || exitAction) {
            return;
        }

        const { clientX, pointerId } = event;
        suppressClick.current = false;
        gesture.current = {
            longPressTimer: window.setTimeout(() => {
                // The tap ending a long press must not open the link, and the same finger
                // must not start a swipe once the drawer has opened.
                suppressClick.current = true;
                gesture.current = null;
                onLongPress();
            }, longPressDurationMs),
            moved: false,
            pointerId,
            startX: clientX
        };
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
        const { current } = gesture;
        const { clientX, currentTarget, pointerId } = event;

        if (!current || pointerId !== current.pointerId) {
            return;
        }

        const { startX } = current;
        const rawOffset = clientX - startX;
        if (!current.moved && Math.abs(rawOffset) > dragActivationPx) {
            if (current.longPressTimer !== null) {
                clearTimeout(current.longPressTimer);
            }

            current.moved = true;
            setDragging(true);
            currentTarget.setPointerCapture(pointerId);
        } else if (!current.moved) {
            return;
        }

        suppressClick.current = true;
        const { offsetWidth: width } = currentTarget;

        setOffsetPx(clampOffset(rawOffset, width));
        setIconVisible(Math.abs(rawOffset) >= width * swipeThresholdRatio);
    };

    const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>): void => {
        if (!releaseGesture()) {
            return;
        }

        const { offsetWidth: width } = event.currentTarget;

        if (Math.abs(offsetPx) < width * swipeThresholdRatio) {
            resetToResting();

            return;
        }

        const action = resolvePendingAction(offsetPx, archived) ?? "delete";
        setExitAction(action);
        setOffsetPx(action === "delete" ? -width : width);
        commitAfterSlideOut(action, bookmark, resetToResting);
    };

    const handlePointerCancel = (): void => {
        if (releaseGesture()) {
            resetToResting();
        }
    };

    return {
        action: exitAction ?? resolvePendingAction(offsetPx, archived),
        dragging,
        iconVisible,
        offsetPx,
        onContentClickCapture,
        onPointerCancel: handlePointerCancel,
        onPointerDown: handlePointerDown,
        onPointerEnd: handlePointerEnd,
        onPointerMove: handlePointerMove
    };
};

interface BookmarkListItemProps {
    archived: boolean;
    bookmark: Bookmark;
}

const BookmarkListItem = ({ archived, bookmark }: BookmarkListItemProps): ReactNode => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const swipe = useSwipeToAction(archived, bookmark, () => {
        setDrawerOpen(true);
    });

    const style = swipe.action ? swipeStyles[swipe.action] : null;
    const contentStyle = {
        transform: `translateX(${swipe.offsetPx.toString()}px)`,
        transition: swipe.dragging ? "none" : `transform ${exitAnimationMs.toString()}ms ease-out`
    } as const;

    return (
        <li className="relative min-w-0 overflow-clip">
            {style && swipe.offsetPx !== restingOffsetPx && (
                <div
                    aria-hidden="true"
                    className={`absolute inset-y-0 flex items-center justify-center ${style.backgroundClass} sm:rounded-xl`}
                    style={{
                        [swipe.action === "delete" ? "right" : "left"]: restingOffsetPx,
                        width: Math.abs(swipe.offsetPx)
                    }}
                >
                    {/* The icon springs in once the swipe passes the threshold. */}
                    <span
                        className="grid place-items-center text-white transition-[opacity,transform] duration-150 ease-out data-[hidden=true]:scale-25 data-[hidden=true]:opacity-0"
                        data-hidden={!swipe.iconVisible}
                    >
                        <style.icon aria-hidden="true" className="size-7" />
                    </span>
                </div>
            )}

            {/* pan-y keeps vertical scrolling with the browser; horizontal pans reach the handlers.
                Native long-press UI must not steal the gesture from the drawer. */}
            {/* h-full passes the grid-stretched li height down to the Card's sm:h-full,
                so cards in one row keep an equal height regardless of title length. */}
            <div
                className="relative h-full touch-pan-y select-none [-webkit-touch-callout:none]"
                onClickCapture={swipe.onContentClickCapture}
                onContextMenu={(event) => {
                    event.preventDefault();
                }}
                onPointerCancel={swipe.onPointerCancel}
                onPointerDown={swipe.onPointerDown}
                onPointerMove={swipe.onPointerMove}
                onPointerUp={swipe.onPointerEnd}
                style={contentStyle}
            >
                <BookmarkCard archived={archived} bookmark={bookmark} />
            </div>

            <Drawer onOpenChange={setDrawerOpen} open={drawerOpen} showSwipeHandle>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle className="line-clamp-2 wrap-anywhere">{bookmark.title}</DrawerTitle>
                    </DrawerHeader>
                    <ul className="pb-2">
                        {getBookmarkCardActions(archived, bookmark).map(({ icon: Icon, label, onSelect, variant }) => (
                            <li key={label}>
                                <button
                                    className={cn(
                                        "flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted",
                                        variant === "destructive" && "text-destructive hover:bg-destructive/10"
                                    )}
                                    onClick={() => {
                                        onSelect();
                                        setDrawerOpen(false);
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
        </li>
    );
};

export { BookmarkListItem };
