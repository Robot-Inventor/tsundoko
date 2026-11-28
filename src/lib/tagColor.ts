import type { CSSProperties } from "react";

const hexColorPattern = /^#[0-9a-f]{6}$/iu;
const hexChannelPattern = /^#(?<red>[0-9a-f]{2})(?<green>[0-9a-f]{2})(?<blue>[0-9a-f]{2})$/iu;
const contrastThreshold = 4.5;
const whiteLuminance = 1;
// #262626, a little lighter than the dark-mode card, so the computed target is conservative.
const darkSurfaceLuminance = 0.0194;
const channelMaximum = 255;
const whiteChannel = 1;
const blackChannel = 0;
const hexRadix = 16;
const hexDigitsPerChannel = 2;
const searchIterations = 20;
// Luminance where white and black text reach the same contrast ratio.
const contrastSplitLuminance = 0.17913;
const blackText = "#000000";
const whiteText = "#ffffff";

// The sRGB transfer curve, named after the published formulas.
const srgbDecodeThreshold = 0.04045;
const srgbEncodeThreshold = 0.0031308;
const srgbOffset = 0.055;
const srgbScale = 1.055;
const srgbLowScale = 12.92;
const srgbGamma = 2.4;
const inverseSrgbGamma = whiteChannel / srgbGamma;
const contrastOffset = 0.05;
const midpointDivisor = 2;
const iterationStep = 1;
// The 8-bit hex round trip can land a hair below the ratio the continuous search found.
const roundingMargin = 0.05;

const luminanceWeights = {
    blue: 0.0722,
    green: 0.7152,
    red: 0.2126
} as const;

const tagColorPresets = [
    "#e5484d",
    "#f76b15",
    "#ffb224",
    "#30a46c",
    "#12a594",
    "#0091ff",
    "#8e4ec6",
    "#e93d82"
] as const;

type LinearColor = readonly [number, number, number];

const isTagColor = (value: string): boolean => hexColorPattern.test(value);

const linearize = (channel: number): number => {
    const value = channel / channelMaximum;

    return value <= srgbDecodeThreshold ? value / srgbLowScale : ((value + srgbOffset) / srgbScale) ** srgbGamma;
};

const encode = (linear: number): number => {
    const value =
        linear <= srgbEncodeThreshold ? linear * srgbLowScale : srgbScale * linear ** inverseSrgbGamma - srgbOffset;

    return Math.round(Math.min(whiteChannel, Math.max(blackChannel, value)) * channelMaximum);
};

// Channels stay in linear light so blending with black or white keeps the hue without
// leaving the sRGB gamut.
const parseHexColor = (hex: string): LinearColor | null => {
    const groups = hexChannelPattern.exec(hex)?.groups;

    if (!groups) {
        return null;
    }

    const { blue = "0", green = "0", red = "0" } = groups;

    return [
        linearize(Number.parseInt(red, hexRadix)),
        linearize(Number.parseInt(green, hexRadix)),
        linearize(Number.parseInt(blue, hexRadix))
    ];
};

const relativeLuminance = ([red, green, blue]: LinearColor): number =>
    luminanceWeights.red * red + luminanceWeights.green * green + luminanceWeights.blue * blue;

const contrastRatio = (one: number, other: number): number =>
    (Math.max(one, other) + contrastOffset) / (Math.min(one, other) + contrastOffset);

const toHex = (color: LinearColor): string =>
    `#${color.map((channel) => encode(channel).toString(hexRadix).padStart(hexDigitsPerChannel, "0")).join("")}`;

const blendToward = (color: LinearColor, target: number, amount: number): LinearColor => [
    color[0] + (target - color[0]) * amount,
    color[1] + (target - color[1]) * amount,
    color[2] + (target - color[2]) * amount
];

// Moves lightness only as far as the contrast target requires, so a color that already reads
// on the surface keeps its exact value.
const readableOn = (color: LinearColor, surfaceLuminance: number, target: number): string => {
    if (contrastRatio(relativeLuminance(color), surfaceLuminance) >= contrastThreshold) {
        return toHex(color);
    }

    let failing = blackChannel;
    let passing = whiteChannel;

    for (let iteration = 0; iteration < searchIterations; iteration += iterationStep) {
        const amount = (failing + passing) / midpointDivisor;
        const candidate = blendToward(color, target, amount);

        if (contrastRatio(relativeLuminance(candidate), surfaceLuminance) >= contrastThreshold) {
            passing = amount;
        } else {
            failing = amount;
        }
    }

    return toHex(blendToward(color, target, Math.min(whiteChannel, passing + roundingMargin)));
};

// One CSS value serves both schemes: the app already sets color-scheme, and light-dark() follows it.
const readableTagColor = (color: string | null): string | undefined => {
    const parsed = color ? parseHexColor(color) : null;

    if (!parsed) {
        return;
    }

    return `light-dark(${readableOn(parsed, whiteLuminance, blackChannel)}, ${readableOn(parsed, darkSurfaceLuminance, whiteChannel)})`;
};

const tagChipTextColor = (color: string): string => {
    const parsed = parseHexColor(color);

    return parsed && relativeLuminance(parsed) > contrastSplitLuminance ? blackText : whiteText;
};

// React's CSSProperties has no index signature for custom properties; declaring the two keys
// here lets the chip pass them inline without a cast.
interface TagChipStyle extends CSSProperties {
    "--tag-color": string;
    "--tag-text-color": string;
}

const tagChipStyle = (color: string): TagChipStyle => ({
    "--tag-color": color,
    "--tag-text-color": tagChipTextColor(color)
});

export { isTagColor, readableTagColor, tagChipStyle, tagColorPresets };
