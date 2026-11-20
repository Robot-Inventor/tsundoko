import { HouseIcon, MenuIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./components/ui/sheet";
import { useEffect, useRef, useState } from "react";
import { Button } from "./components/ui/button";

const desktopLayout = "(min-width: 48rem)";

interface HomeNavigationProps {
    homeLinkRef?: React.Ref<HTMLAnchorElement>;
    onNavigate?: () => void;
}

const HomeNavigation = ({ homeLinkRef, onNavigate }: HomeNavigationProps): React.JSX.Element => (
    <nav aria-label="メインナビゲーション" className="px-3 py-2">
        <a
            aria-current="page"
            className="flex min-h-11 items-center gap-2 rounded-lg bg-sidebar-accent px-3 text-sm font-semibold text-sidebar-accent-foreground focus-visible:focus-outline"
            href="/"
            onClick={onNavigate}
            ref={homeLinkRef}
        >
            <HouseIcon aria-hidden="true" className="size-4" />
            ホーム
        </a>
    </nav>
);

const App = (): React.JSX.Element => {
    const [menuOpen, setMenuOpen] = useState(false);
    const desktopHomeLink = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        // An open modal must release focus and scroll lock when the desktop navigation takes over.
        const desktop = window.matchMedia(desktopLayout);
        const closeOnDesktop = (event: MediaQueryListEvent): void => {
            if (event.matches) {
                setMenuOpen(false);
            }
        };

        desktop.addEventListener("change", closeOnDesktop);

        return (): void => {
            desktop.removeEventListener("change", closeOnDesktop);
        };
    }, []);

    return (
        <>
            <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-3 md:px-4">
                <Sheet onOpenChange={setMenuOpen} open={menuOpen}>
                    <SheetTrigger
                        aria-label="メニューを開く"
                        render=<Button className="size-11 md:hidden" size="icon" variant="ghost" />
                    >
                        <MenuIcon aria-hidden="true" />
                    </SheetTrigger>
                    <SheetContent
                        finalFocus={() => (window.matchMedia(desktopLayout).matches ? desktopHomeLink.current : true)}
                    >
                        <SheetTitle>メニュー</SheetTitle>
                        <HomeNavigation
                            onNavigate={() => {
                                setMenuOpen(false);
                            }}
                        />
                    </SheetContent>
                </Sheet>
                <span className="font-semibold">Tsundoko</span>
            </header>

            <div className="flex min-h-[calc(100dvh-3.5rem)]">
                <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto border-e bg-sidebar text-sidebar-foreground md:block">
                    <HomeNavigation homeLinkRef={desktopHomeLink} />
                </aside>
                <main className="min-w-0 flex-1 p-4 md:p-6">
                    <h1 className="text-xl font-semibold">ホーム</h1>
                </main>
            </div>
        </>
    );
};

export { App };
