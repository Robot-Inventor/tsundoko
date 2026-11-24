import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const desktopLayout = "(min-width: 48rem)";

interface UseSearchResult {
    clearSearch: () => void;
    closeSearch: () => void;
    desktopSearchInput: React.RefObject<HTMLInputElement | null>;
    mobileSearchInput: React.RefObject<HTMLInputElement | null>;
    openSearch: () => void;
    query: string;
    runSearch: () => void;
    searchOpen: boolean;
    searchText: string;
    setSearchText: (value: string) => void;
}

const useSearch = (searchEnabled: boolean): UseSearchResult => {
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [searchText, setSearchText] = useState("");
    const desktopSearchInput = useRef<HTMLInputElement>(null);
    const mobileSearchInput = useRef<HTMLInputElement>(null);

    const openSearch = useCallback((): void => {
        setSearchOpen(true);
    }, []);

    const runSearch = useCallback((): void => {
        const trimmed = searchText.trim();

        setQuery(trimmed);
        setSearchText(trimmed);
        setSearchOpen(false);
    }, [searchText]);

    const clearSearch = useCallback((): void => {
        setQuery("");
        setSearchText("");
    }, []);

    const closeSearch = useCallback((): void => {
        // Discard uncommitted edits; the last executed query stays active.
        setSearchText(query);
        setSearchOpen(false);
    }, [query]);

    const focusSearch = useCallback((): void => {
        if (window.matchMedia(desktopLayout).matches) {
            desktopSearchInput.current?.focus();

            return;
        }

        if (searchOpen) {
            mobileSearchInput.current?.focus();

            return;
        }

        // Opening flips focusOnOpen; the bar focuses its own input.
        setSearchOpen(true);
    }, [searchOpen]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            const { target } = event;
            const typing =
                target instanceof HTMLElement &&
                (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

            const modifier = event.ctrlKey || event.metaKey;
            const isSearchShortcut =
                searchEnabled && modifier && !event.altKey && !event.shiftKey && event.code === "KeyK";

            const isSlashShortcut = searchEnabled && event.key === "/" && !modifier && !event.altKey && !typing;

            if (isSearchShortcut) {
                event.preventDefault();
                focusSearch();
            } else if (isSlashShortcut) {
                event.preventDefault();
                focusSearch();
            }
        };

        window.addEventListener("keydown", onKeyDown);

        // The swapped bar is unreachable on desktop and would reappear stale on smaller screens.
        const desktop = window.matchMedia(desktopLayout);
        const closeOnDesktop = (event: MediaQueryListEvent): void => {
            if (event.matches) {
                closeSearch();
            }
        };

        desktop.addEventListener("change", closeOnDesktop);

        return (): void => {
            window.removeEventListener("keydown", onKeyDown);
            desktop.removeEventListener("change", closeOnDesktop);
        };
    }, [closeSearch, focusSearch, searchEnabled]);

    return {
        clearSearch,
        closeSearch,
        desktopSearchInput,
        mobileSearchInput,
        openSearch,
        query,
        runSearch,
        searchOpen: searchEnabled && searchOpen,
        searchText,
        setSearchText
    };
};

const SearchContext = createContext<UseSearchResult | null>(null);

// Lives around the router Outlet in AppLayout so that both the header bar and every page share one search state.
const useSearchContext = (): UseSearchResult => {
    const context = useContext(SearchContext);

    if (!context) {
        throw new Error("useSearchContext requires the search context from AppLayout.");
    }

    return context;
};

export { type UseSearchResult, SearchContext, desktopLayout, useSearch, useSearchContext };
