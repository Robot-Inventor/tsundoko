import { Drawer } from "@base-ui/react/drawer";
import type { ReactNode } from "react";
import { overlayBackdropClass } from "../../lib/overlay";
import { cn } from "../../lib/utils";

// The panel must keep exiting in step with the shared overlay backdrop: the
// portal unmounts when the panel's transition ends, so a longer backdrop fade
// would be cut off.
const sheetTransition = "duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";

const Sheet = (props: Omit<Drawer.Root.Props, "swipeDirection">): ReactNode => (
    // "left" is the swipe direction that dismisses: the start-anchored sheet exits
    // through the edge it slid in from, like a native app menu.
    <Drawer.Root {...props} swipeDirection="left" />
);

const SheetTrigger = (props: Drawer.Trigger.Props): ReactNode => (
    <Drawer.Trigger data-slot="sheet-trigger" {...props} />
);

const SheetContent = ({
    children,
    className,
    ...props
}: Omit<Drawer.Popup.Props, "className"> & { className?: string }): ReactNode => (
    <Drawer.Portal>
        {/* The swipe-linked dimming overrides the shared base dim through cn's
            tailwind-merge, so the backdrop tracks the panel while swiping. */}
        <Drawer.Backdrop
            data-slot="sheet-overlay"
            className={cn(
                overlayBackdropClass,
                "min-h-dvh bg-black/[calc(10%*(1-var(--drawer-swipe-progress)))] data-swiping:duration-0"
            )}
        />
        <Drawer.Viewport data-slot="sheet-viewport" className="fixed inset-0 z-50 flex items-stretch justify-start">
            <Drawer.Popup
                data-slot="sheet-content"
                className={cn(
                    "flex h-full w-3/4 max-w-xs flex-col pt-14 overflow-y-auto overscroll-contain touch-auto border-e bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg outline-none will-change-transform [transform:translateX(var(--drawer-swipe-movement-x))] transition-transform data-swiping:select-none data-starting-style:[transform:translateX(-100%)] data-ending-style:[transform:translateX(-100%)]",
                    sheetTransition,
                    className
                )}
                {...props}
            >
                <Drawer.Content>{children}</Drawer.Content>
            </Drawer.Popup>
        </Drawer.Viewport>
    </Drawer.Portal>
);

const SheetTitle = (props: Drawer.Title.Props): ReactNode => (
    // The dialog's accessible name; visually hidden because the sheet content makes it obvious.
    <Drawer.Title className="sr-only" data-slot="sheet-title" {...props} />
);

export { Sheet, SheetContent, SheetTitle, SheetTrigger };
