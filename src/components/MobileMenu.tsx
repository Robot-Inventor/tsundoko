import { type ReactNode, useCallback, useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { MenuIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { desktopLayout } from "../hooks/useSearch";
import { useSwipeToOpenMenu } from "../hooks/useSwipeToOpenMenu";

interface MobileMenuProps {
    children: ReactNode;
    finalFocus: (closeType: string) => HTMLElement | boolean | null;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    searchOpen: boolean;
}

// The header's sheet and the empty-space swipe share one open state, so the gesture lives
// beside the trigger instead of in the layout that renders them.
const MobileMenu = ({ children, finalFocus, onOpenChange, open, searchOpen }: MobileMenuProps): ReactNode => {
    // Stays set after closing: Base UI reads finalFocus while the popup unmounts, so clearing it
    // on close would restore focus to the trigger again. The next trigger open clears it.
    const [openedBySwipe, setOpenedBySwipe] = useState(false);

    const openBySwipe = useCallback((): void => {
        setOpenedBySwipe(true);
        onOpenChange(true);
    }, [onOpenChange]);

    // Base UI only reports opens that come from its own interactions, so this marks every
    // trigger press while the swipe path above marks the gesture.
    const handleOpenChange = (nextOpen: boolean): void => {
        if (nextOpen) {
            setOpenedBySwipe(false);
        }

        onOpenChange(nextOpen);
    };

    // Safari applies :focus-visible to programmatic focus, so returning focus to the trigger
    // after a swipe leaves a ring on the hamburger button. A keyboard close keeps it for tab
    // users, and a desktop takeover must still move focus to the sidebar's home link.
    const resolveFinalFocus = (closeType: string): HTMLElement | boolean | null => {
        const staysMobile = !window.matchMedia(desktopLayout).matches;
        const suppressReturnFocus = openedBySwipe && closeType !== "keyboard" && staysMobile;

        return suppressReturnFocus ? false : finalFocus(closeType);
    };

    // While the search bar is open its input owns the header, so a swipe must not fight typing.
    useSwipeToOpenMenu({
        enabled: !open && !searchOpen,
        onOpen: openBySwipe
    });

    return (
        <Sheet onOpenChange={handleOpenChange} open={open}>
            <SheetTrigger
                aria-label="メニューを開く"
                render=<Button
                    className={cn(
                        "size-11 transition-opacity duration-200 md:hidden motion-reduce:transition-none",
                        searchOpen && "pointer-events-none opacity-0"
                    )}
                    inert={searchOpen}
                    size="icon"
                    variant="ghost"
                />
            >
                <MenuIcon aria-hidden="true" />
            </SheetTrigger>
            <SheetContent className="pt-[calc(2rem_+_env(safe-area-inset-top))]" finalFocus={resolveFinalFocus}>
                <SheetTitle>メニュー</SheetTitle>
                {children}
            </SheetContent>
        </Sheet>
    );
};

export { MobileMenu };
