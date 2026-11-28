import { useLayoutEffect, useState } from "react";
import { countFirstViewItems } from "../lib/firstViewItems";

const initialItemCount = 1;
const noColumns = 0;

// The grid's auto-fill tracks are resolved by CSS, so reading them keeps this measurement in
// sync with the breakpoints, sidebar, and gaps that decide how many columns actually fit.
const countColumns = (grid: HTMLElement): number => {
    const tracks = getComputedStyle(grid).gridTemplateColumns;

    return tracks === "none" ? noColumns : tracks.split(" ").length;
};

interface ViewportItemCount {
    firstViewCount: number;
    gridRef: (element: HTMLElement | null) => void;
}

const useViewportItemCount = (): ViewportItemCount => {
    const [grid, setGrid] = useState<HTMLElement | null>(null);
    const [firstViewCount, setFirstViewCount] = useState(initialItemCount);

    // Layout effect: the first skeleton row must already span the viewport before paint.
    useLayoutEffect(() => {
        if (!grid) {
            return;
        }

        const measure = (): void => {
            const firstItem = grid.firstElementChild;

            if (!firstItem) {
                return;
            }

            const next = countFirstViewItems({
                columns: countColumns(grid),
                gridTop: grid.getBoundingClientRect().top,
                rowHeight: firstItem.getBoundingClientRect().height,
                viewportHeight: window.innerHeight
            });

            setFirstViewCount((current) => (current === next ? current : next));
        };

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(grid);
        window.addEventListener("resize", measure);

        return (): void => {
            observer.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [grid]);

    return {
        firstViewCount,
        gridRef: setGrid
    };
};

export { useViewportItemCount };
