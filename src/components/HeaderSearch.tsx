import { type ReactNode, useLayoutEffect, useRef } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "./ui/button";
import { SearchBar } from "./SearchBar";
import type { UseSearchResult } from "../hooks/useSearch";
import { cn } from "../lib/utils";
import { useTranslation } from "react-i18next";

// Stays mounted so both the entrance and the exit animate; inert keeps the hidden input unreachable.
// start-4 matches the bookmark thumbnails' inset; end-16 covers the header's 12px padding,
// the toggle's 44px, and the 8px gap, so the bar ends beside it.
const MobileSearch = ({ search }: { search: UseSearchResult }): ReactNode => (
    <div
        className={cn(
            "absolute start-4 end-16 top-[env(safe-area-inset-top)] bottom-0 flex items-center transition-[opacity,translate,scale] duration-200 ease-out md:hidden motion-reduce:transition-none",
            search.searchOpen ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-95 opacity-0"
        )}
        inert={!search.searchOpen}
    >
        <SearchBar
            className="w-full"
            focusOnOpen={search.searchOpen}
            inputRef={search.mobileSearchInput}
            onClear={search.clearSearch}
            onSearch={search.runSearch}
            onSearchTextChange={search.setSearchText}
            searchText={search.searchText}
        />
    </div>
);

const MobileSearchToggle = ({ search, visible }: { search: UseSearchResult; visible: boolean }): ReactNode => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const wasOpen = useRef(false);
    const { t: translate } = useTranslation();

    useLayoutEffect(() => {
        // Enter runs the search without touching this button, so give keyboard users their place back.
        const restoreFocus = visible && wasOpen.current && !search.searchOpen;

        if (restoreFocus) {
            buttonRef.current?.focus();
        }

        wasOpen.current = search.searchOpen;
    }, [search.searchOpen, visible]);

    return (
        <Button
            aria-label={translate(search.searchOpen ? "common.closeSearch" : "common.openSearch")}
            className={cn(
                "ms-auto size-11 transition-[opacity,rotate,scale] duration-200 ease-out md:hidden motion-reduce:transition-none",
                visible ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0"
            )}
            inert={!visible}
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

const HeaderSearch = ({ search, visible }: { search: UseSearchResult; visible: boolean }): ReactNode => (
    <>
        <MobileSearchToggle search={search} visible={visible} />
        {/* Centered on the viewport instead of the space next to the logo; w-full prevents shrink-to-fit
            sizing from collapsing the absolutely positioned bar to the input's intrinsic width. */}
        <div className="absolute left-1/2 top-[calc(env(safe-area-inset-top)_+_1.75rem)] hidden w-full max-w-xl -translate-x-1/2 -translate-y-1/2 md:block">
            <div
                className={cn(
                    "transition-[opacity,translate,scale] duration-200 ease-out motion-reduce:transition-none",
                    visible ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-95 opacity-0"
                )}
                inert={!visible}
            >
                <SearchBar
                    inputRef={search.desktopSearchInput}
                    onClear={search.clearSearch}
                    onSearch={search.runSearch}
                    onSearchTextChange={search.setSearchText}
                    searchText={search.searchText}
                />
            </div>
        </div>
        <MobileSearch search={search} />
    </>
);

export { HeaderSearch };
