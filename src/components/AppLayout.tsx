import { AccountProvider, MobileAccountMenu, SidebarAccountMenu, useAccountState } from "./AccountMenu";
import { ArchiveIcon, HouseIcon, MenuIcon, SearchIcon, XIcon } from "lucide-react";
import { HeadContent, Link, Outlet, useLocation } from "@tanstack/react-router";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SearchContext, type UseSearchResult, desktopLayout, useSearch } from "../hooks/useSearch";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { SearchBar } from "./SearchBar";
import { cn } from "../lib/utils";
import { getPage } from "../lib/page-title";

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

const Logo = ({ className }: { className: string }): ReactNode => (
    <img alt="Tsundoko" className={className} height={370} src="/logo.svg" width={1666} />
);

// The mobile header carries the page title; each page hides its own h1 on mobile so exactly one
// h1 is visible per breakpoint.
const MobilePageTitle = ({ searchOpen }: { searchOpen: boolean }): ReactNode => {
    const { pathname } = useLocation();

    return (
        <h1
            className={cn(
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-base font-semibold transition-opacity duration-200 md:hidden motion-reduce:transition-none",
                searchOpen && "opacity-0"
            )}
            inert={searchOpen}
        >
            {getPage(pathname).label}
        </h1>
    );
};

// Stays mounted so both the entrance and the exit animate; inert keeps the hidden input unreachable.
// start-4 matches the bookmark thumbnails' inset; end-16 covers the header's 12px padding,
// the toggle's 44px, and the 8px gap, so the bar ends beside it.
const MobileSearch = ({ search }: { search: UseSearchResult }): ReactNode => (
    <div
        className={cn(
            "absolute inset-y-0 start-4 end-16 flex items-center transition-[opacity,translate,scale] duration-200 ease-out md:hidden motion-reduce:transition-none",
            search.searchOpen ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-95 opacity-0"
        )}
        inert={!search.searchOpen}
    >
        <SearchBar
            className="w-full"
            focusOnOpen={search.searchOpen}
            inputRef={search.mobileSearchInput}
            onSearch={search.runSearch}
            onSearchTextChange={search.setSearchText}
            searchText={search.searchText}
        />
    </div>
);

const MobileSearchToggle = ({ search }: { search: UseSearchResult }): ReactNode => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const wasOpen = useRef(false);

    useLayoutEffect(() => {
        // Enter runs the search without touching this button, so give keyboard users their place back.
        if (wasOpen.current && !search.searchOpen) {
            buttonRef.current?.focus();
        }

        wasOpen.current = search.searchOpen;
    }, [search.searchOpen]);

    return (
        <Button
            aria-label={search.searchOpen ? "検索を閉じる" : "検索を開く"}
            className="ms-auto size-11 md:hidden"
            onClick={search.searchOpen ? search.closeSearch : search.openSearch}
            ref={buttonRef}
            size="icon"
            variant="ghost"
        >
            <span className="relative block size-4">
                <SearchIcon
                    aria-hidden="true"
                    className={cn(
                        "absolute inset-0 size-4 rotate-0 scale-100 opacity-100 transition-[opacity,rotate,scale] duration-200 ease-out motion-reduce:transition-none",
                        search.searchOpen && "rotate-90 scale-50 opacity-0"
                    )}
                />
                <XIcon
                    aria-hidden="true"
                    className={cn(
                        "absolute inset-0 size-4 rotate-90 scale-50 opacity-0 transition-[opacity,rotate,scale] duration-200 ease-out motion-reduce:transition-none",
                        search.searchOpen && "rotate-0 scale-100 opacity-100"
                    )}
                />
            </span>
        </Button>
    );
};

const HeaderSearch = ({ search }: { search: UseSearchResult }): ReactNode => (
    <>
        <MobileSearchToggle search={search} />
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
        <MobileSearch search={search} />
    </>
);

const AppLayout = (): ReactNode => {
    const { pathname } = useLocation();
    // Settings has no bookmark list, so it must not offer a search box or its keyboard shortcuts.
    const showsSearch = !pathname.startsWith("/settings");
    const search = useSearch(showsSearch);
    const [menuOpen, setMenuOpen] = useState(false);
    const desktopHomeLink = useRef<HTMLAnchorElement>(null);
    const accountState = useAccountState();
    const { account } = accountState;

    const closeMenu = (): void => {
        setMenuOpen(false);
    };

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
        <AccountProvider value={accountState}>
            <HeadContent />
            <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-3 md:px-4">
                <Sheet onOpenChange={setMenuOpen} open={menuOpen}>
                    <SheetTrigger
                        aria-label="メニューを開く"
                        render=<Button
                            className={cn(
                                "size-11 transition-opacity duration-200 md:hidden motion-reduce:transition-none",
                                search.searchOpen && "pointer-events-none opacity-0"
                            )}
                            inert={search.searchOpen}
                            size="icon"
                            variant="ghost"
                        />
                    >
                        <MenuIcon aria-hidden="true" />
                    </SheetTrigger>
                    <SheetContent
                        className="pt-8"
                        finalFocus={() => (window.matchMedia(desktopLayout).matches ? desktopHomeLink.current : true)}
                    >
                        <div className="mb-6 flex items-center justify-between gap-3 ps-6 pe-3">
                            <Logo className="block h-auto w-1/2" />
                            {account && <MobileAccountMenu account={account} onNavigate={closeMenu} />}
                        </div>
                        <SheetTitle>メニュー</SheetTitle>
                        <MainNavigation onNavigate={closeMenu} />
                    </SheetContent>
                </Sheet>
                <Logo className="hidden h-auto w-32 md:block" />
                <MobilePageTitle searchOpen={search.searchOpen} />
                {showsSearch && <HeaderSearch search={search} />}
            </header>

            <div className="flex min-h-[calc(100dvh-3.5rem)]">
                <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col overflow-y-auto border-e bg-sidebar text-sidebar-foreground md:flex">
                    <MainNavigation homeLinkRef={desktopHomeLink} />
                    {account && (
                        <div className="mt-auto border-t p-3">
                            <SidebarAccountMenu account={account} />
                        </div>
                    )}
                </aside>
                <main className="min-w-0 flex-1 p-4 md:p-6">
                    <SearchContext value={search}>
                        <Outlet />
                    </SearchContext>
                </main>
            </div>
        </AccountProvider>
    );
};

export { AppLayout };
