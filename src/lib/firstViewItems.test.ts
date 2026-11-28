import { describe, expect, it } from "vitest";
import { countFirstViewItems } from "./firstViewItems";

const oneItem = 1;
const twoItems = 2;
const fourItems = 4;
const twelveItems = 12;
const fortyItems = 40;
const fixedSkeletonCount = 6;

describe("countFirstViewItems", () => {
    it("covers every row visible below the grid's top edge, rounding up a partial row", () => {
        const count = countFirstViewItems({
            columns: 1,
            gridTop: 100,
            rowHeight: 120,
            viewportHeight: 500
        });

        expect(count).toBe(fourItems);
    });

    it("multiplies the visible rows by every column in the grid", () => {
        const count = countFirstViewItems({
            columns: 3,
            gridTop: 100,
            rowHeight: 200,
            viewportHeight: 900
        });

        expect(count).toBe(twelveItems);
    });

    it("grows with the viewport instead of stopping at a fixed placeholder count", () => {
        const count = countFirstViewItems({
            columns: 4,
            gridTop: 100,
            rowHeight: 200,
            viewportHeight: 2000
        });

        expect(count).toBe(fortyItems);
        expect(count).toBeGreaterThan(fixedSkeletonCount);
    });

    it("keeps one row of items when the grid starts below the viewport", () => {
        const count = countFirstViewItems({
            columns: 2,
            gridTop: 1000,
            rowHeight: 100,
            viewportHeight: 800
        });

        expect(count).toBe(twoItems);
    });

    it("falls back to a single item when the grid has no measurable columns or rows", () => {
        const noColumns = countFirstViewItems({
            columns: 0,
            gridTop: 0,
            rowHeight: 100,
            viewportHeight: 800
        });

        const noRows = countFirstViewItems({
            columns: 3,
            gridTop: 0,
            rowHeight: 0,
            viewportHeight: 800
        });

        expect(noColumns).toBe(oneItem);
        expect(noRows).toBe(oneItem);
    });
});
