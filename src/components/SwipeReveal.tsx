// The reveal background showing through the transparent card during a swipe: its width
// follows the finger while dragging, and its icon fades and scales in past the threshold.
import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from "lucide-react";
import { exitAnimationMs, restingOffsetPx } from "../lib/swipe";
import type { BookmarkActionKind } from "../lib/bookmarkActions";
import type { ReactNode } from "react";

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

interface SwipeRevealProps {
    action: BookmarkActionKind | null;
    collapsing: boolean;
    dragging: boolean;
    iconVisible: boolean;
    offsetPx: number;
}

const SwipeReveal = ({ action, collapsing, dragging, iconVisible, offsetPx }: SwipeRevealProps): ReactNode => {
    // collapsing keeps the strip mounted for one exit-animation cycle so the icon can fade
    // out while its width collapses in step with the returning card.
    const revealActive = offsetPx !== restingOffsetPx || collapsing;

    if (action === null || !revealActive) {
        return null;
    }

    const style = swipeStyles[action];

    return (
        <div
            aria-hidden="true"
            className={`absolute inset-y-0 flex items-center justify-center ${style.backgroundClass} sm:rounded-xl`}
            style={{
                [action === "delete" ? "right" : "left"]: restingOffsetPx,
                // The width follows the card's return transition so the receding reveal edge stays glued to the card.
                transition: dragging ? "none" : `width ${exitAnimationMs.toString()}ms ease-out`,
                width: Math.abs(offsetPx)
            }}
        >
            {/* Fades and grows past the threshold, reverses below it. Tailwind v4's scale
                utilities animate the standalone scale property, not transform. */}
            <span
                className="grid place-items-center text-white transition-[opacity,scale] duration-200 ease-out data-[hidden=true]:scale-25 data-[hidden=true]:opacity-0"
                data-hidden={!iconVisible}
            >
                <style.icon aria-hidden="true" className="size-7" />
            </span>
        </div>
    );
};

export { SwipeReveal };
