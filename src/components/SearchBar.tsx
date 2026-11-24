import { type ReactNode, useLayoutEffect } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "./ui/Input";
import { getSearchLabel } from "../lib/page-title";
import { useLocation } from "@tanstack/react-router";

interface SearchBarProps {
    className?: string;
    focusOnOpen?: boolean;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onSearch: () => void;
    onSearchTextChange: (value: string) => void;
    searchText: string;
}

const SearchBar = ({
    className,
    focusOnOpen,
    inputRef,
    onSearch,
    onSearchTextChange,
    searchText
}: SearchBarProps): ReactNode => {
    const { pathname } = useLocation();
    const label = getSearchLabel(pathname);

    // A layout effect keeps focus inside the tap or keystroke that opened the bar, which iOS
    // requires to open the keyboard. The mobile bar stays mounted, so the same effect blurs on close.
    useLayoutEffect(() => {
        if (focusOnOpen === true) {
            inputRef.current?.focus();
        } else if (focusOnOpen === false) {
            inputRef.current?.blur();
        }
    }, [focusOnOpen, inputRef]);

    return (
        <form
            className={className}
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                onSearch();
            }}
            role="search"
        >
            <div className="relative w-full">
                <SearchIcon
                    aria-hidden="true"
                    className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                    aria-label={label}
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect="off"
                    className="h-10 pl-8 pr-8"
                    onChange={(event) => {
                        onSearchTextChange(event.currentTarget.value);
                    }}
                    onKeyDown={(event) => {
                        // Enter during IME composition confirms the reading and must not run the search.
                        if (event.key === "Enter" && event.nativeEvent.isComposing) {
                            event.preventDefault();
                        }

                        // preventDefault also suppresses the browser's native "clear the field" on Escape;
                        // during IME composition Escape must keep canceling the conversion instead of blurring.
                        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            event.currentTarget.blur();
                        }
                    }}
                    placeholder={label}
                    ref={inputRef}
                    spellCheck={false}
                    type="search"
                    value={searchText}
                />
                {searchText !== "" && (
                    // A plain button avoids the Button press animation, whose translate-y-px
                    // would stomp -translate-y-1/2 and visibly drop the button before it unmounts.
                    <button
                        aria-label="検索ワードを消去"
                        className="absolute end-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:focus-outline dark:hover:bg-muted/50"
                        onClick={() => {
                            onSearchTextChange("");
                            inputRef.current?.focus();
                        }}
                        onMouseDown={(event) => {
                            // Keep focus in the input instead of flickering it onto the button.
                            event.preventDefault();
                        }}
                        type="button"
                    >
                        <XIcon aria-hidden="true" className="size-4" />
                    </button>
                )}
            </div>
        </form>
    );
};

export { SearchBar };
