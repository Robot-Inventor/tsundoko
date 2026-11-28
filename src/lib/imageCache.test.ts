/* oxlint-disable no-magic-numbers -- The image dimensions are what these tests assert. */
import { describe, expect, it } from "vitest";
import { faviconCacheKey, renderWebp } from "./imageCache";
import sharp from "sharp";

const makePng = async (width: number, height: number): Promise<Uint8Array> => {
    const png = await sharp({
        create: {
            background: "#3366ff",
            channels: 3,
            height,
            width
        }
    })
        .png()
        .toBuffer();

    return new Uint8Array(png);
};

describe("renderWebp", () => {
    it("scales an image down to the target width and encodes it as WebP", async () => {
        const webp = await renderWebp(await makePng(1200, 600), 800);
        const metadata = await sharp(Buffer.from(webp)).metadata();

        expect([metadata.format, metadata.width, metadata.height]).toEqual(["webp", 800, 400]);
    });

    it("keeps an image smaller than the target width at its own size", async () => {
        const webp = await renderWebp(await makePng(32, 32), 64);
        const metadata = await sharp(Buffer.from(webp)).metadata();

        expect([metadata.format, metadata.width, metadata.height]).toEqual(["webp", 32, 32]);
    });

    it("rejects data that is not an image", async () => {
        const notAnImage = new Uint8Array(Buffer.from("not an image"));

        await expect(renderWebp(notAnImage, 800)).rejects.toThrow();
    });
});

describe("faviconCacheKey", () => {
    it("derives one stable file name per hostname", () => {
        expect(faviconCacheKey("example.com")).toBe(faviconCacheKey("example.com"));
        expect(faviconCacheKey("example.com")).not.toBe(faviconCacheKey("example.org"));
    });
});
