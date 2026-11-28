const minimumItemCount = 1;
const unmeasurableRowHeight = 0;

interface FirstViewMetrics {
    columns: number;
    gridTop: number;
    rowHeight: number;
    viewportHeight: number;
}

// The grid fills its container with as many rows as the viewport can show. Rounding up keeps
// the last row covered even when only part of it is visible; that same count marks which
// thumbnails are in the first view and can skip lazy loading.
const countFirstViewItems = ({ columns, gridTop, rowHeight, viewportHeight }: FirstViewMetrics): number => {
    if (columns < minimumItemCount || rowHeight <= unmeasurableRowHeight) {
        return minimumItemCount;
    }

    const visibleHeight = Math.max(viewportHeight - gridTop, rowHeight);

    return columns * Math.ceil(visibleHeight / rowHeight);
};

export { countFirstViewItems };
