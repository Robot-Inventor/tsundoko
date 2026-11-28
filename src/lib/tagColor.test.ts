import { describe, expect, it } from "vitest";
import { isTagColor, readableTagColor, tagChipStyle, tagColorPresets } from "./tagColor";

const contrastThreshold = 4.5;
const channelMaximum = 255;
const blackChannel = 0;
const contrastOffset = 0.05;
const hexRadix = 16;
const lightSurface = "#ffffff";
const darkSurface = "#262626";
const surfacePattern = /^#(?<red>[0-9a-f]{2})(?<green>[0-9a-f]{2})(?<blue>[0-9a-f]{2})$/u;
const variantPattern = /^light-dark\((?<light>#[0-9a-f]{6}), (?<dark>#[0-9a-f]{6})\)$/u;

const srgbDecodeThreshold = 0.04045;
const srgbLowScale = 12.92;
const srgbOffset = 0.055;
const srgbScale = 1.055;
const srgbGamma = 2.4;

const luminanceWeights = {
    blue: 0.0722,
    green: 0.7152,
    red: 0.2126
} as const;

const luminance = (hex: string): number => {
    const groups = surfacePattern.exec(hex)?.groups ?? {};
    const channels = ["red", "green", "blue"].map(
        (name) => Number.parseInt(groups[name] ?? "0", hexRadix) / channelMaximum
    );

    const [red = blackChannel, green = blackChannel, blue = blackChannel] = channels.map((channel) =>
        channel <= srgbDecodeThreshold ? channel / srgbLowScale : ((channel + srgbOffset) / srgbScale) ** srgbGamma
    );

    return luminanceWeights.red * red + luminanceWeights.green * green + luminanceWeights.blue * blue;
};

const contrastRatio = (one: string, other: string): number => {
    const first = luminance(one);
    const second = luminance(other);

    return (Math.max(first, second) + contrastOffset) / (Math.min(first, second) + contrastOffset);
};

const variants = (value: string | undefined): { dark: string; light: string } => {
    const groups = variantPattern.exec(value ?? "")?.groups;

    if (!groups) {
        throw new Error(`Unexpected tag color: ${String(value)}`);
    }

    return {
        dark: groups.dark,
        light: groups.light
    };
};

describe("isTagColor", () => {
    it("accepts six-digit hexadecimal colors in either case", () => {
        expect(isTagColor("#1f6feb")).toBe(true);
        expect(isTagColor("#AABBCC")).toBe(true);
    });

    it("rejects other color formats", () => {
        expect(isTagColor("#abc")).toBe(false);
        expect(isTagColor("1f6feb")).toBe(false);
        expect(isTagColor("blue")).toBe(false);
        expect(isTagColor("#1f6febff")).toBe(false);
    });
});

describe("readableTagColor", () => {
    it("returns no color when the tag has none", () => {
        expect(readableTagColor(null)).toBeUndefined();
    });

    it("returns no color for an unparseable value", () => {
        expect(readableTagColor("blue")).toBeUndefined();
    });

    it("keeps every preset at or above the text contrast minimum on both surfaces", () => {
        for (const preset of tagColorPresets) {
            const { dark, light } = variants(readableTagColor(preset));

            expect(contrastRatio(light, lightSurface)).toBeGreaterThanOrEqual(contrastThreshold);
            expect(contrastRatio(dark, darkSurface)).toBeGreaterThanOrEqual(contrastThreshold);
        }
    });

    it("darkens a pale color for the light theme and leaves it for the dark theme", () => {
        const source = "#ffb224";
        const { dark, light } = variants(readableTagColor(source));

        expect(luminance(light)).toBeLessThan(luminance(source));
        expect(dark).toBe(source);
    });

    it("lightens a deep color for the dark theme and leaves it for the light theme", () => {
        const source = "#1e3a8a";
        const { dark, light } = variants(readableTagColor(source));

        expect(luminance(dark)).toBeGreaterThan(luminance(source));
        expect(light).toBe(source);
    });
});

describe("tagChipStyle", () => {
    it("uses dark text on a light background", () => {
        expect(tagChipStyle("#ffb224")["--tag-text-color"]).toBe("#000000");
    });

    it("uses light text on a dark background", () => {
        expect(tagChipStyle("#1e3a8a")["--tag-text-color"]).toBe("#ffffff");
    });

    it("passes the color through for the stylesheet", () => {
        expect(tagChipStyle("#30a46c")["--tag-color"]).toBe("#30a46c");
    });
});
