// oxlint-disable id-length -- "q" is the search parameter name defined by the URL.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { parseSearchQuery } from "../lib/searchQuery";

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

interface SearchState {
    finishLoading: () => void;
    isListLoading: boolean;
    isSearching: boolean;
    searchText: string;
    setSearchText: (value: string) => void;
    startListLoading: () => void;
}

// Back/Forward and direct links change the query outside the search bar, so the input follows the
// URL while an unfinished fetch keeps the progress indicator on until the results settle.
const useSearchState = (query: string): SearchState => {
    const queryRef = useRef(query);
    const [draft, setDraft] = useState({ query, text: query });
    const [progressQuery, setProgressQuery] = useState(query);
    const [isListLoading, setIsListLoading] = useState(false);

    // A history navigation replaces the committed query; discard any draft typed against the old one.
    if (draft.query !== query) {
        setDraft({ query, text: query });
    }

    useEffect(() => {
        queryRef.current = query;
    }, [query]);

    const setSearchText = useCallback(
        (value: string): void => {
            setDraft({ query, text: value });
        },
        [query]
    );

    const finishLoading = useCallback((): void => {
        setProgressQuery(queryRef.current);
        setIsListLoading(false);
    }, []);

    const startListLoading = useCallback((): void => {
        setIsListLoading(true);
    }, []);

    return {
        finishLoading,
        isListLoading,
        isSearching: progressQuery !== query,
        searchText: draft.text,
        setSearchText,
        startListLoading
    };
};

const useSearchQuery = (): string =>
    // useLocation exposes the parsed but unvalidated search, so route validation alone is not enough.
    useLocation({
        select: (location) => parseSearchQuery({ ...location.search }).q ?? ""
    });

const useSearch = (searchEnabled: boolean, pathname: string): UseSearchResult => {
    const navigate = useNavigate();
    const query = useSearchQuery();

    const { finishLoading, isListLoading, isSearching, searchText, setSearchText, startListLoading } =
        useSearchState(query);

    const [searchOpen, setSearchOpen] = useState(false);
    const desktopSearchInput = useRef<HTMLInputElement>(null);
    const mobileSearchInput = useRef<HTMLInputElement>(null);

    const resetSearch = useCallback((): void => {
        setSearchOpen(false);
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

        void navigate({
            search: trimmed
                ? {
                      q: trimmed
                  }
                : {},
            to: "."
        });
    }, [navigate, query, searchText, setSearchText]);

    const clearSearch = useCallback((): void => {
        setSearchText("");

        if (query === "") {
            return;
        }

        void navigate({
            search: {},
            to: "."
        });
    }, [navigate, query, setSearchText]);

    const closeSearch = useCallback((): void => {
        // Discard uncommitted edits; the last executed query stays active.
        setSearchText(query);
        setSearchOpen(false);
    }, [query, setSearchText]);

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
