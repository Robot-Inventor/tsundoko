import { Progress } from "./ui/progress";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { useTranslation } from "react-i18next";

interface SearchProgressProps {
    // A sort change refetches the list but is not a search.
    loading: boolean;
    searching: boolean;
}

// Absolute inside the sticky header so the bar tracks it without taking part in the document flow.
const SearchProgress = ({ loading, searching }: SearchProgressProps): ReactNode => {
    const { t: translate } = useTranslation();
    const visible = loading || searching;
    const label = translate(searching ? "common.searching" : "common.loading");

    return (
        <Progress
            aria-hidden={!visible}
            aria-label={label}
            aria-valuetext={label}
            className={cn(
                "pointer-events-none absolute inset-x-0 top-full transition-opacity duration-150 motion-reduce:transition-none",
                // Pausing keeps the segment in place while the bar fades out instead of snapping back.
                visible ? "opacity-100" : "opacity-0 [&_[data-slot=progress-indicator]]:[animation-play-state:paused]",
                "[&_[data-slot=progress-track]]:h-0.5 [&_[data-slot=progress-track]]:rounded-none [&_[data-slot=progress-track]]:bg-primary/15",
                "[&_[data-slot=progress-indicator]]:animate-search-progress [&_[data-slot=progress-indicator]]:w-1/3 [&_[data-slot=progress-indicator]]:bg-primary [&_[data-slot=progress-indicator]]:transition-none",
                "motion-reduce:[&_[data-slot=progress-indicator]]:animate-none"
            )}
            inert={!visible}
            value={null}
        />
    );
};

export { SearchProgress };
