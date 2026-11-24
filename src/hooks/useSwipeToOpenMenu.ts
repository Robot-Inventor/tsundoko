import { desktopLayout } from "./useSearch";
import { touchPointerType } from "../lib/swipe";
import { useEffect } from "react";

// Empty-space swipes open the mobile menu; bookmark rows and controls keep their own gestures.
// The threshold stays above the browser's touch slop so a tap cannot turn into an open menu.
const swipeActivationPx = 32;

// visualViewport.scale starts at 1; anything above it means the user has pinch-zoomed.
const unzoomedScale = 1;

// Elements that own the pointer stream: controls, bookmark rows, and the skeletons standing in for rows.
const gestureOwnerSelector =
    'a, button, label, summary, input, textarea, select, [contenteditable], [role="button"], [role="checkbox"], [role="link"], [role="menuitem"], [role="option"], [role="switch"], [role="tab"], [data-swipe-zone]';

// Base UI unmounts overlays on close, so any match means a modal currently owns the screen.
const openOverlaySelector = '[data-slot="sheet-viewport"], [data-slot="drawer-viewport"], [data-slot="dialog-content"]';

interface SwipeToOpenMenuOptions {
    enabled: boolean;
    onOpen: () => void;
}

interface SwipeGesture {
    pointerId: number;
    startX: number;
    startY: number;
}

// The touch-action rule that keeps horizontal pans for the gesture also blocks panning a zoomed
// page. Mark the document while zoomed so CSS can hand the pans back to the browser; the menu
// button still opens the menu. Zoom lives on the visual viewport, not in a media query.
const useZoomedPageMarker = (): void => {
    useEffect(() => {
        const viewport = window.visualViewport;

        if (viewport === null) {
            return;
        }

        const root = document.documentElement;
        const syncZoom = (): void => {
            root.dataset["zoomed"] = viewport.scale > unzoomedScale ? "true" : "false";
        };

        syncZoom();
        viewport.addEventListener("resize", syncZoom);

        return (): void => {
            viewport.removeEventListener("resize", syncZoom);
            delete root.dataset["zoomed"];
        };
    }, []);
};

const useSwipeToOpenMenu = ({ enabled, onOpen }: SwipeToOpenMenuOptions): void => {
    useZoomedPageMarker();

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let gesture: SwipeGesture | null = null;

        const endGesture = (): void => {
            gesture = null;
        };

        const handlePointerDown = (event: PointerEvent): void => {
            const { target } = event;

            // A pinch or a resting thumb adds a second finger; abandon the armed gesture instead of
            // letting either finger move 32px and open the menu mid-zoom.
            if (!event.isPrimary) {
                gesture = null;

                return;
            }

            // Mouse and pen drags stay inert; the menu is a touch affordance for the mobile layout.
            if (event.pointerType !== touchPointerType || window.matchMedia(desktopLayout).matches) {
                return;
            }

            if (!(target instanceof Element)) {
                return;
            }

            // Bookmark rows, controls, skeletons and open modals own their own gestures.
            if (target.closest(gestureOwnerSelector) !== null) {
                return;
            }

            if (document.querySelector(openOverlaySelector) !== null) {
                return;
            }

            gesture = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY
            };
        };

        const handlePointerMove = (event: PointerEvent): void => {
            if (gesture === null || event.pointerId !== gesture.pointerId) {
                return;
            }

            const deltaX = event.clientX - gesture.startX;
            const deltaY = event.clientY - gesture.startY;

            // A scroll that only later drifts sideways must not turn into a menu swipe.
            if (Math.abs(deltaY) > swipeActivationPx && Math.abs(deltaY) > Math.abs(deltaX)) {
                gesture = null;

                return;
            }

            // Rightwards only: the sheet waits at the left edge, so this pulls it in.
            if (deltaX >= swipeActivationPx && deltaX > Math.abs(deltaY)) {
                gesture = null;
                onOpen();
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", endGesture);
        document.addEventListener("pointercancel", endGesture);

        return (): void => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("pointermove", handlePointerMove);
            document.removeEventListener("pointerup", endGesture);
            document.removeEventListener("pointercancel", endGesture);
        };
    }, [enabled, onOpen]);
};

export { useSwipeToOpenMenu };
