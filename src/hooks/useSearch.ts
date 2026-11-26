import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const desktopLayout = "(min-width: 48rem)";

interface UseSearchResult {
    clearSearch: () => void;
    closeSearch: () => void;
    desktopSearchInput: React.RefObject<HTMLInputElement | null>;
    finishLoading: () => void;
    isListLoading: boolean;
    isSearching: boolean;
    mobileSearchInput: React.RefObject<HTMLInputElement | null>;
    openSearch: () => void;
    query: string;
    runSearch: () => void;
    searchOpen: boolean;
    searchText: string;
    setSearchText: (value: string) => void;
    startListLoading: () => void;
}

const useSearchShortcuts = (searchEnabled: boolean, closeSearch: () => void, focusSearch: () => void): void => {
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

            if (isSearchShortcut || isSlashShortcut) {
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
};

const useResetOnRouteChange = (pathname: string, reset: () => void): void => {
    const [previousPathname, setPreviousPathname] = useState(pathname);

    // Clear during render so a newly mounted page never fetches with the previous page's keyword.
    if (previousPathname !== pathname) {
        setPreviousPathname(pathname);
        reset();
    }
};

interface LoadingFlags {
    finishLoading: () => void;
    isListLoading: boolean;
    isSearching: boolean;
    startListLoading: () => void;
    startSearch: () => void;
}

// Search and sorting share one progress bar; keeping both flags together prevents one from lingering.
const useLoadingFlags = (): LoadingFlags => {
    const [isSearching, setIsSearching] = useState(false);
    const [isListLoading, setIsListLoading] = useState(false);

    const finishLoading = useCallback((): void => {
        setIsSearching(false);
        setIsListLoading(false);
    }, []);

    const startListLoading = useCallback((): void => {
        setIsListLoading(true);
    }, []);

    const startSearch = useCallback((): void => {
        setIsSearching(true);
    }, []);

    return {
        finishLoading,
        isListLoading,
        isSearching,
        startListLoading,
        startSearch
    };
};

const useSearch = (searchEnabled: boolean, pathname: string): UseSearchResult => {
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [searchText, setSearchText] = useState("");
    const { finishLoading, isListLoading, isSearching, startListLoading, startSearch } = useLoadingFlags();
    const desktopSearchInput = useRef<HTMLInputElement>(null);
    const mobileSearchInput = useRef<HTMLInputElement>(null);

    const resetSearch = useCallback((): void => {
        setSearchOpen(false);
        setQuery("");
        setSearchText("");
        finishLoading();
    }, [finishLoading]);

    useResetOnRouteChange(pathname, resetSearch);

    const openSearch = useCallback((): void => {
        setSearchOpen(true);
    }, []);

    const runSearch = useCallback((): void => {
        const trimmed = searchText.trim();

        setSearchText(trimmed);
        setSearchOpen(false);

        // An unchanged query does not refetch, so the bar must not be left on screen.
        if (trimmed === query) {
            return;
        }

        setQuery(trimmed);
        startSearch();
    }, [query, searchText, startSearch]);

    const clearSearch = useCallback((): void => {
        setSearchText("");

        if (query === "") {
            return;
        }

        setQuery("");
        startSearch();
    }, [query, startSearch]);

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

    useSearchShortcuts(searchEnabled, closeSearch, focusSearch);

    return {
        clearSearch,
        closeSearch,
        desktopSearchInput,
        finishLoading,
        isListLoading,
        isSearching,
        mobileSearchInput,
        openSearch,
        query,
        runSearch,
        searchOpen: searchEnabled && searchOpen,
        searchText,
        setSearchText,
        startListLoading
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
