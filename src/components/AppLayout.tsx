import { AccountProvider, MobileAccountMenu, SidebarAccountMenu } from "./AccountMenu";
import { ArchiveIcon, HouseIcon } from "lucide-react";
import { HeadContent, Link, Outlet, useLocation } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { SearchContext, desktopLayout, useSearch } from "../hooks/useSearch";
import { HeaderSearch } from "./HeaderSearch";
import { MobileMenu } from "./MobileMenu";
import { cn } from "../lib/utils";
import { getPage } from "../lib/page-title";
import { useAccountState } from "../hooks/useAccount";

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
                "absolute left-1/2 top-[calc(env(safe-area-inset-top)_+_1.75rem)] -translate-x-1/2 -translate-y-1/2 text-base font-semibold transition-opacity duration-200 md:hidden motion-reduce:transition-none",
                searchOpen && "opacity-0"
            )}
            inert={searchOpen}
        >
            {getPage(pathname).label}
        </h1>
    );
};

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
            <header className="sticky top-0 z-20 flex h-[calc(3.5rem_+_env(safe-area-inset-top))] items-center gap-2 border-b bg-background px-3 pt-[env(safe-area-inset-top)] md:px-4">
                <MobileMenu
                    finalFocus={() => (window.matchMedia(desktopLayout).matches ? desktopHomeLink.current : true)}
                    onOpenChange={setMenuOpen}
                    open={menuOpen}
                    searchOpen={search.searchOpen}
                >
                    <div className="mb-6 flex items-center justify-between gap-3 ps-6 pe-3">
                        <Logo className="block h-auto w-1/2" />
                        {account && <MobileAccountMenu account={account} onNavigate={closeMenu} />}
                    </div>
                    <MainNavigation onNavigate={closeMenu} />
                </MobileMenu>
                <Logo className="hidden h-auto w-32 md:block" />
                <MobilePageTitle searchOpen={search.searchOpen} />
                {showsSearch && <HeaderSearch search={search} />}
            </header>

            <div className="flex min-h-[calc(100dvh_-_3.5rem_-_env(safe-area-inset-top))]">
                <aside className="sticky top-[calc(3.5rem_+_env(safe-area-inset-top))] hidden h-[calc(100dvh_-_3.5rem_-_env(safe-area-inset-top))] w-56 shrink-0 flex-col overflow-y-auto border-e bg-sidebar text-sidebar-foreground md:flex">
                    <MainNavigation homeLinkRef={desktopHomeLink} />
                    {account && (
                        <div className="mt-auto border-t p-3">
                            <SidebarAccountMenu account={account} />
                        </div>
                    )}
                </aside>
                <main className="min-w-0 flex-1 p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] md:p-6 md:pb-6">
                    <SearchContext value={search}>
                        <Outlet />
                    </SearchContext>
                </main>
            </div>
        </AccountProvider>
    );
};

export { AppLayout };
