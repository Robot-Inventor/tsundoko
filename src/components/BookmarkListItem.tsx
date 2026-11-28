import { type BookmarkActionKind, requestBookmarkAction } from "../lib/bookmarkActions";
import { type ReactNode, useRef, useState } from "react";
import { exitAnimationMs, restingOffsetPx, touchPointerType } from "../lib/swipe";
import type { Bookmark } from "../lib/bookmark";
import { BookmarkCard } from "./BookmarkCard";
import { BookmarkItemDrawer } from "./BookmarkItemDrawer";
import { EditBookmarkDialog } from "./EditBookmarkDialog";
import { SwipeReveal } from "./SwipeReveal";

// A swipe reveals the colored background in proportion to the finger travel; crossing
// 30% of the row width reveals the icon, releasing past it commits the action.
const swipeThresholdRatio = 0.3;
// Small movements are still taps and must keep opening the bookmark link.
const dragActivationPx = 8;
const longPressDurationMs = 500;

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
const commitAfterSlideOut = (
    action: BookmarkActionKind,
    bookmark: Bookmark,
    resetToResting: (action: BookmarkActionKind | null) => void
): void => {
    window.setTimeout(() => {
        requestBookmarkAction(action, bookmark);
        resetToResting(action);
    }, exitAnimationMs);
};

interface SwipeGesture {
    action: BookmarkActionKind | null;
    collapsing: boolean;
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
    // Keeps the reveal's style during the return so its icon can animate out instead of
    // vanishing the instant the offset hits rest.
    const [returnAction, setReturnAction] = useState<BookmarkActionKind | null>(null);
    const gesture = useRef<{
        longPressTimer: number | null;
        moved: boolean;
        pointerId: number;
        startX: number;
    } | null>(null);

    const returnTimer = useRef<number | null>(null);

    const suppressClick = useRef(false);
    // oxlint-disable-next-line react/refs -- Only the ref object is passed on; it is never read during render.
    const onContentClickCapture = createClickCaptureGuard(suppressClick);

    // The reveal stays mounted for one exit-animation cycle so the icon fades out and the
    // strip collapses in step with the returning card.
    const resetToResting = (action: BookmarkActionKind | null): void => {
        if (returnTimer.current !== null) {
            clearTimeout(returnTimer.current);
            returnTimer.current = null;
        }

        setIconVisible(false);
        setReturnAction(action);
        setOffsetPx(restingOffsetPx);
        returnTimer.current = window.setTimeout(() => {
            returnTimer.current = null;
            setReturnAction(null);
        }, exitAnimationMs);
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
        // A fresh press ends a collapse still animating so its style cannot bleed into the new drag.
        setReturnAction(null);
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
            resetToResting(resolvePendingAction(offsetPx, archived));

            return;
        }

        const action = resolvePendingAction(offsetPx, archived) ?? "delete";
        setExitAction(action);
        setOffsetPx(action === "delete" ? -width : width);
        commitAfterSlideOut(action, bookmark, resetToResting);
    };

    const handlePointerCancel = (): void => {
        if (releaseGesture()) {
            resetToResting(resolvePendingAction(offsetPx, archived));
        }
    };

    return {
        action: exitAction ?? returnAction ?? resolvePendingAction(offsetPx, archived),
        collapsing: returnAction !== null,
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
    eager: boolean;
    showPublishedDate: boolean;
}

const BookmarkListItem = ({ archived, bookmark, eager, showPublishedDate }: BookmarkListItemProps): ReactNode => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const swipe = useSwipeToAction(archived, bookmark, () => {
        setDrawerOpen(true);
    });

    const contentStyle = {
        transform: `translateX(${swipe.offsetPx.toString()}px)`,
        transition: swipe.dragging ? "none" : `transform ${exitAnimationMs.toString()}ms ease-out`
    } as const;

    return (
        <li className="relative min-w-0 overflow-clip">
            <SwipeReveal
                action={swipe.action}
                collapsing={swipe.collapsing}
                dragging={swipe.dragging}
                iconVisible={swipe.iconVisible}
                offsetPx={swipe.offsetPx}
            />

            {/* pan-y keeps vertical scrolling with the browser; horizontal pans reach the handlers.
                Native long-press UI must not steal the gesture from the drawer. */}
            {/* h-full passes the grid-stretched li height down to the Card's sm:h-full so one row's cards keep equal heights. */}
            {/* Swipe margins ride inside the transform: 16px sides, half the row gap top and bottom. */}
            {/* The wrapper is not interactive; this only cancels the stretched link's click after a swipe. */}
            {/* oxlint-disable-next-line react-doctor/click-events-have-key-events */}
            <div
                className="relative h-full touch-pan-y select-none [-webkit-touch-callout:none] max-sm:px-4 max-sm:py-3"
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
                <BookmarkCard
                    archived={archived}
                    bookmark={bookmark}
                    eager={eager}
                    onEdit={() => {
                        setEditOpen(true);
                    }}
                    showPublishedDate={showPublishedDate}
                />
            </div>

            <BookmarkItemDrawer
                archived={archived}
                bookmark={bookmark}
                onEdit={() => {
                    setEditOpen(true);
                }}
                onOpenChange={setDrawerOpen}
                open={drawerOpen}
            />

            <EditBookmarkDialog bookmark={bookmark} onOpenChange={setEditOpen} open={editOpen} />
        </li>
    );
};

export { BookmarkListItem };
