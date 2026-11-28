// oxlint-disable import/max-dependencies -- The layout wires navigation, search, tags, and account state.
import { AccountProvider, MobileAccountMenu, SidebarAccountMenu } from "./AccountMenu";
import { Drawer, DrawerContent, DrawerTitle } from "./ui/drawer";
import { Outlet, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { SearchContext, desktopLayout, useSearch } from "../hooks/useSearch";
import { type TagChange, TagEditDialog } from "./TagEditDialog";
import { TagListContext, useTagList } from "../hooks/useTagList";
import { type TagSummary, tagNameKey } from "../lib/tags";
import { HeaderSearch } from "./HeaderSearch";
import { MainNavigation } from "./MainNavigation";
import { MobileMenu } from "./MobileMenu";
import { PencilIcon } from "lucide-react";
import { SearchProgress } from "./SearchProgress";
import { cn } from "../lib/utils";
import { getPage } from "../lib/page-title";
import { useAccountState } from "../hooks/useAccount";
import { useLocale } from "../hooks/useLocale";
import { useTranslation } from "react-i18next";

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

// oxlint-disable-next-line max-lines-per-function, max-statements -- The layout composes the header, sidebar, and overlays in one tree; splitting it would only thread the same state through props.
const AppLayout = (): ReactNode => {
    const { pathname } = useLocation();
    // Bookmark list pages put the sort button in their leading row, so on mobile that row replaces
    // the top content padding instead of sitting below it. They also carry the search bar and the
    // search progress indicator.
    const isBookmarkListPage = pathname === "/" || pathname === "/archive" || pathname.startsWith("/tags/");
    const search = useSearch(isBookmarkListPage, pathname);
    const tagList = useTagList(pathname);
    const [menuOpen, setMenuOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<TagSummary | null>(null);
    const [actionsTag, setActionsTag] = useState<TagSummary | null>(null);
    // A tag picked in the action drawer waits in a ref until the drawer has finished closing,
    // so the editor never mounts while the drawer still owns focus.
    const pendingEditTag = useRef<TagSummary | null>(null);
    const desktopHomeLink = useRef<HTMLAnchorElement>(null);
    const accountState = useAccountState();
    const { account } = accountState;
    const { locale, setLocale } = useLocale();
    const appliedAccountLocale = useRef(false);
    const navigate = useNavigate();
    const params = useParams({ strict: false });
    const { t: translate } = useTranslation();
    const currentTag = typeof params.tag === "string" ? params.tag : "";

    const closeMenu = (): void => {
        setMenuOpen(false);
    };

    const openTagActions = (tag: TagSummary): void => {
        // The drawer layers over the open sheet, so the menu stays where the user left it.
        setActionsTag(tag);
    };

    const followRenamedTag = ({ from, to }: TagChange): void => {
        if (currentTag && tagNameKey(currentTag) === tagNameKey(from)) {
            void navigate({
                params: {
                    tag: to
                },
                replace: true,
                search: true,
                to: "/tags/$tag"
            });
        }
    };

    const leaveDeletedTag = (name: string): void => {
        if (currentTag && tagNameKey(currentTag) === tagNameKey(name)) {
            void navigate({ replace: true, to: "/" });
        }
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
                        <MainNavigation
                            onEditTag={setEditingTag}
                            onLongPressTag={openTagActions}
                            onNavigate={closeMenu}
                        />
                    </MobileMenu>
                    <Logo className="hidden h-auto w-32 md:block" />
                    <MobilePageTitle query={search.query} searchOpen={search.searchOpen} />
                    <HeaderSearch search={search} visible={isBookmarkListPage} />
                    {/* Only bookmark list pages fetch a list, so only they can show search progress. */}
                    {isBookmarkListPage ? (
                        <SearchProgress loading={search.isListLoading} searching={search.isSearching} />
                    ) : null}
                </header>

                <div className="flex min-h-[calc(100dvh_-_3.5rem_-_env(safe-area-inset-top))]">
                    <aside className="sticky top-[calc(3.5rem_+_env(safe-area-inset-top))] hidden h-[calc(100dvh_-_3.5rem_-_env(safe-area-inset-top))] w-56 shrink-0 flex-col overflow-y-auto border-e bg-sidebar text-sidebar-foreground md:flex">
                        <MainNavigation
                            homeLinkRef={desktopHomeLink}
                            onEditTag={setEditingTag}
                            onLongPressTag={openTagActions}
                        />
                        {account && (
                            <div className="mt-auto border-t p-3">
                                <SidebarAccountMenu account={account} />
                            </div>
                        )}
                    </aside>
                    <main
                        className={cn(
                            "min-w-0 flex-1 p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] md:p-6 md:pb-6",
                            isBookmarkListPage && search.query === "" && "max-md:pt-0"
                        )}
                    >
                        <SearchContext value={search}>
                            <Outlet />
                        </SearchContext>
                    </main>
                </div>
            </AccountProvider>

            <Drawer
                onOpenChange={(open) => {
                    if (!open) {
                        setActionsTag(null);
                    }
                }}
                onOpenChangeComplete={(open) => {
                    const tag = pendingEditTag.current;

                    if (!open && tag) {
                        pendingEditTag.current = null;
                        setEditingTag(tag);
                    }
                }}
                open={actionsTag !== null}
                showSwipeHandle
            >
                <DrawerContent>
                    <DrawerTitle className="sr-only">{actionsTag?.name ?? ""}</DrawerTitle>
                    <ul className="py-2">
                        <li>
                            <button
                                className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted"
                                onClick={() => {
                                    if (actionsTag) {
                                        pendingEditTag.current = actionsTag;
                                        setActionsTag(null);
                                    }
                                }}
                                type="button"
                            >
                                <PencilIcon aria-hidden="true" className="size-4" />
                                {translate("tag.edit")}
                            </button>
                        </li>
                    </ul>
                </DrawerContent>
            </Drawer>

            {editingTag ? (
                <TagEditDialog
                    key={editingTag.id}
                    onClose={() => {
                        setEditingTag(null);
                    }}
                    onDeleted={leaveDeletedTag}
                    onSaved={followRenamedTag}
                    tag={editingTag}
                />
            ) : null}
        </TagListContext.Provider>
    );
};

export { AppLayout };
