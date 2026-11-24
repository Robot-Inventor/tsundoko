import { describe, expect, it } from "vitest";
import { isAvatarType, renderAvatar } from "./avatarImage";
import sharp from "sharp";

const avatarSize = 256;

describe("isAvatarType", () => {
    it("accepts the raster formats the endpoint can process", () => {
        expect(isAvatarType("image/png")).toBe(true);
        expect(isAvatarType("IMAGE/JPEG; charset=binary")).toBe(true);
        expect(isAvatarType("image/webp")).toBe(true);
    });

    it("rejects formats that could execute as a document or that sharp cannot decode", () => {
        expect(isAvatarType("image/svg+xml")).toBe(false);
        expect(isAvatarType("image/gif")).toBe(false);
        expect(isAvatarType("text/plain")).toBe(false);
        expect(isAvatarType("")).toBe(false);
    });
});

describe("renderAvatar", () => {
    it("crops a wide image into a square WebP data URL", async () => {
        const source = await sharp({
            create: {
                background: "#3366ff",
                channels: 3,
                height: 300,
                width: 600
            }
        })
            .png()
            .toBuffer();

        const avatarUrl = await renderAvatar(new Uint8Array(source));
        const encoded = avatarUrl.split(",")[1] ?? "";
        const metadata = await sharp(Buffer.from(encoded, "base64")).metadata();

        expect(avatarUrl.startsWith("data:image/webp;base64,")).toBe(true);
        expect([metadata.format, metadata.width, metadata.height]).toEqual(["webp", avatarSize, avatarSize]);
    });

    it("rejects data that is not an image", async () => {
        const notAnImage = new Uint8Array(Buffer.from("not an image"));

        await expect(renderAvatar(notAnImage)).rejects.toThrow();
    });
});
