// oxlint-disable import/max-dependencies -- The layout wires navigation, search, tags, and account state.
import { AccountProvider, MobileAccountMenu, SidebarAccountMenu } from "./AccountMenu";
import { ArchiveIcon, HouseIcon, TagIcon } from "lucide-react";
import { Link, Outlet, useLocation, useParams } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { SearchContext, desktopLayout, useSearch } from "../hooks/useSearch";
import { TagListContext, useTagList, useTagListContext } from "../hooks/useTagList";
import { HeaderSearch } from "./HeaderSearch";
import { MobileMenu } from "./MobileMenu";
import { SearchProgress } from "./SearchProgress";
import { cn } from "../lib/utils";
import { getPage } from "../lib/page-title";
import { useAccountState } from "../hooks/useAccount";
import { useLocale } from "../hooks/useLocale";
import { useTranslation } from "react-i18next";

const navLinkClass =
    "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold focus-visible:focus-outline data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground";

const homeActiveOptions = {
    exact: true
} as const;

interface MainNavigationProps {
    homeLinkRef?: React.Ref<HTMLAnchorElement>;
    onNavigate?: () => void;
}

const MainNavigation = ({ homeLinkRef, onNavigate }: MainNavigationProps): ReactNode => {
    const { tags } = useTagListContext();
    const { t: translate } = useTranslation();

    return (
        <nav aria-label={translate("common.mainNavigation")} className="px-3 py-2">
            <Link
                activeOptions={homeActiveOptions}
                className={navLinkClass}
                onClick={onNavigate}
                ref={homeLinkRef}
                to="/"
            >
                <HouseIcon aria-hidden="true" className="size-4" />
                {translate("common.home")}
            </Link>
            <Link className={navLinkClass} onClick={onNavigate} to="/archive">
                <ArchiveIcon aria-hidden="true" className="size-4" />
                {translate("common.archive")}
            </Link>
            {tags.length ? (
                <div className="mt-4">
                    <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">{translate("common.tags")}</p>
                    {tags.map((tag) => (
                        <Link
                            className={navLinkClass}
                            key={tag.name}
                            onClick={onNavigate}
                            params={{ tag: tag.name }}
                            to="/tags/$tag"
                        >
                            <TagIcon aria-hidden="true" className="size-4 shrink-0" />
                            <span className="truncate">{tag.name}</span>
                        </Link>
                    ))}
                </div>
            ) : null}
        </nav>
    );
};

const Logo = ({ className }: { className: string }): ReactNode => (
    <img alt="Tsundoko" className={className} height={370} src="/logo.svg" width={1666} />
);

// The mobile header carries the page title; each page hides its own h1 on mobile so exactly one
// h1 is visible per breakpoint. On a list page an active query is more important than the page name,
// so the title states which keyword the displayed results belong to.
const MobilePageTitle = ({ query, searchOpen }: { query: string; searchOpen: boolean }): ReactNode => {
    const { pathname } = useLocation();
    const params = useParams({ strict: false });
    const { t: translate } = useTranslation();
    const page = getPage(pathname);
    const pageLabel = params.tag ?? translate(page.label);
    const label = query === "" ? pageLabel : translate("search.resultsFor", { query });

    return (
        <h1
            aria-label={label}
            className={cn(
                "absolute left-1/2 top-[calc(env(safe-area-inset-top)_+_1.75rem)] max-w-[calc(100%_-_8rem)] -translate-x-1/2 -translate-y-1/2 truncate text-base font-semibold transition-opacity duration-200 md:hidden motion-reduce:transition-none",
                searchOpen && "opacity-0"
            )}
            inert={searchOpen}
            title={label}
        >
            {label}
        </h1>
    );
};

const AppLayout = (): ReactNode => {
    const { pathname } = useLocation();
    // Tag pages list bookmarks too, so they keep the same search bar and progress indicator.
    const isListPage = pathname === "/" || pathname === "/archive" || pathname.startsWith("/tags/");
    const showsSearch = isListPage;
    const search = useSearch(showsSearch, pathname);
    const tagList = useTagList(pathname);
    const [menuOpen, setMenuOpen] = useState(false);
    const desktopHomeLink = useRef<HTMLAnchorElement>(null);
    const accountState = useAccountState();
    const { account } = accountState;
    const { locale, setLocale } = useLocale();
    const appliedAccountLocale = useRef(false);

    const closeMenu = (): void => {
        setMenuOpen(false);
    };

    // Apply the server locale once when the account first loads. Later refreshes must not undo
    // a locale the user just changed in settings while its save request is still in flight.
    useEffect(() => {
        if (account?.locale && !appliedAccountLocale.current) {
            appliedAccountLocale.current = true;

            if (account.locale !== locale) {
                setLocale(account.locale);
            }
        }
    }, [account?.locale, locale, setLocale]);

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
        <TagListContext.Provider value={tagList}>
            <AccountProvider value={accountState}>
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
                    <MobilePageTitle query={search.query} searchOpen={search.searchOpen} />
                    <HeaderSearch search={search} visible={showsSearch} />
                    {/* Only bookmark list pages fetch a list, so only they can show search progress. */}
                    {isListPage ? <SearchProgress searching={search.isSearching} /> : null}
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
        </TagListContext.Provider>
    );
};

export { AppLayout };
