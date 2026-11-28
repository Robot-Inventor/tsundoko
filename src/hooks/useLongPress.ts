import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";

const longPressDurationMs = 500;
// A finger that travels further than this is scrolling, not holding.
const moveTolerancePx = 10;

interface LongPressHandlers {
    onClickCapture: (event: ReactMouseEvent<HTMLElement>) => void;
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
}

// Touch only: mouse users reach the same action through the hover menu, and a long mouse press
// would otherwise fire while selecting text.
const useLongPress = (onLongPress: () => void): LongPressHandlers => {
    const timer = useRef<number | null>(null);
    const origin = useRef<{ x: number; y: number } | null>(null);
    const suppressClick = useRef(false);

    const clear = (): void => {
        if (timer.current !== null) {
            clearTimeout(timer.current);
            timer.current = null;
        }

        origin.current = null;
    };

    // A row removed while held must not open the drawer after the fact.
    useEffect(
        () => (): void => {
            if (timer.current !== null) {
                clearTimeout(timer.current);
            }
        },
        []
    );

    const handleClickCapture = (event: ReactMouseEvent<HTMLElement>): void => {
        if (!suppressClick.current) {
            return;
        }

        // The tap that ended the hold must not navigate.
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
    };

    const handleContextMenu = (event: ReactMouseEvent<HTMLElement>): void => {
        // Only touch devices need the native menu suppressed; desktop keeps right-click actions.
        if (window.matchMedia("(hover: none)").matches) {
            event.preventDefault();
        }
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
        if (event.pointerType !== "touch" || !event.isPrimary) {
            return;
        }

        suppressClick.current = false;

        // Capture keeps the release on this row even when the finger drifts off it.
        event.currentTarget.setPointerCapture(event.pointerId);

        origin.current = {
            x: event.clientX,
            y: event.clientY
        };

        timer.current = window.setTimeout(() => {
            timer.current = null;
            suppressClick.current = true;
            onLongPress();
        }, longPressDurationMs);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLElement>): void => {
        const start = origin.current;

        if (!start) {
            return;
        }

        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > moveTolerancePx) {
            clear();
        }
    };

    return {
        onClickCapture: handleClickCapture,
        onContextMenu: handleContextMenu,
        onPointerCancel: clear,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: clear
    };
};

export { useLongPress };
