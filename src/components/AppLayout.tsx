import { ArchiveIcon, HouseIcon, MenuIcon, SearchIcon, XIcon } from "lucide-react";
import { Link, Outlet } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { SearchContext, desktopLayout, useSearch } from "../hooks/useSearch";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { SearchBar } from "./SearchBar";
import { cn } from "../lib/utils";

const navLinkClass =
    "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold focus-visible:focus-outline data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground";

const homeActiveOptions = {
    exact: true
} as const;

interface MainNavigationProps {
    homeLinkRef?: React.Ref<HTMLAnchorElement>;
    onNavigate?: () => void;
}

const MainNavigation = ({ homeLinkRef, onNavigate }: MainNavigationProps): ReactNode => (
    <nav aria-label="メインナビゲーション" className="px-3 py-2">
        <Link activeOptions={homeActiveOptions} className={navLinkClass} onClick={onNavigate} ref={homeLinkRef} to="/">
            <HouseIcon aria-hidden="true" className="size-4" />
            ホーム
        </Link>
        <Link className={navLinkClass} onClick={onNavigate} to="/archive">
            <ArchiveIcon aria-hidden="true" className="size-4" />
            アーカイブ
        </Link>
    </nav>
);

const AppLayout = (): ReactNode => {
    const search = useSearch();
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
                        render=<Button
                            className={cn("size-11 md:hidden", search.searchOpen && "hidden")}
                            size="icon"
                            variant="ghost"
                        />
                    >
                        <MenuIcon aria-hidden="true" />
                    </SheetTrigger>
                    <SheetContent
                        finalFocus={() => (window.matchMedia(desktopLayout).matches ? desktopHomeLink.current : true)}
                    >
                        <SheetTitle>メニュー</SheetTitle>
                        <MainNavigation
                            onNavigate={() => {
                                setMenuOpen(false);
                            }}
                        />
                    </SheetContent>
                </Sheet>
                <span className={cn("font-semibold", search.searchOpen && "hidden md:inline")}>Tsundoko</span>
                <Button
                    aria-label="検索を開く"
                    className={cn("ms-auto size-11 md:hidden", search.searchOpen && "hidden")}
                    onClick={search.openSearch}
                    size="icon"
                    variant="ghost"
                >
                    <SearchIcon aria-hidden="true" />
                </Button>
                {/* Centered on the viewport instead of the space next to the logo; w-full prevents shrink-to-fit
                    sizing from collapsing the absolutely positioned bar to the input's intrinsic width. */}
                <div className="absolute left-1/2 top-1/2 hidden w-full max-w-xl -translate-x-1/2 -translate-y-1/2 md:block">
                    <SearchBar
                        inputRef={search.desktopSearchInput}
                        onSearch={search.runSearch}
                        onSearchTextChange={search.setSearchText}
                        searchText={search.searchText}
                    />
                </div>
                {search.searchOpen && (
                    <div className="flex w-full items-center gap-2 md:hidden">
                        <SearchBar
                            autoFocus
                            className="min-w-0 flex-1"
                            inputRef={search.mobileSearchInput}
                            onSearch={search.runSearch}
                            onSearchTextChange={search.setSearchText}
                            searchText={search.searchText}
                        />
                        <Button aria-label="検索を閉じる" onClick={search.closeSearch} size="icon" variant="ghost">
                            <XIcon aria-hidden="true" />
                        </Button>
                    </div>
                )}
            </header>

            <div className="flex min-h-[calc(100dvh-3.5rem)]">
                <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto border-e bg-sidebar text-sidebar-foreground md:block">
                    <MainNavigation homeLinkRef={desktopHomeLink} />
                </aside>
                <main className="min-w-0 flex-1 p-4 md:p-6">
                    <SearchContext value={search}>
                        <Outlet />
                    </SearchContext>
                </main>
            </div>
        </>
    );
};

export { AppLayout };
