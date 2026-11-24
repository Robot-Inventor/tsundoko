import { MIMEType } from "node:util";
import sharp from "sharp";

const avatarSizePx = 256;
const avatarQuality = 80;
// A 16-megapixel decode is far above any avatar; the limit stops a small compressed file from
// expanding into gigabytes of pixels.
const maxAvatarPixels = 16_777_216;

const avatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const isAvatarType = (contentType: string): boolean => {
    try {
        return avatarTypes.has(new MIMEType(contentType).essence);
    } catch {
        return false;
    }
};

const renderAvatar = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
    const webp = await sharp(bytes, { limitInputPixels: maxAvatarPixels })
        // Camera photos carry their rotation in EXIF; baking it in keeps the crop upright.
        .rotate()
        .resize(avatarSizePx, avatarSizePx, { fit: "cover" })
        .webp({ quality: avatarQuality })
        .toBuffer();

    return `data:image/webp;base64,${webp.toString("base64")}`;
};

export { isAvatarType, renderAvatar };
