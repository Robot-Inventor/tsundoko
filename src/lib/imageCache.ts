import { createHash, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { fetchValidImage } from "./remoteImage";
import sharp from "sharp";

// Everything fetched from other sites is stored under data/, which the deployment keeps across
// restarts.
const dataRoot = "data";
const thumbnailsDir = resolve(dataRoot, "images", "thumbnails");
const faviconsDir = resolve(dataRoot, "images", "favicons");

const thumbnailWidthPx = 800;
const faviconWidthPx = 64;
const webpQuality = 80;
// The proxy caps a download at 10 MiB, but a compressed image can still decode to far more pixels.
// 16 megapixels covers any real thumbnail while bounding what a burst of encodes may allocate.
const maxImagePixels = 16_777_216;

const renderWebp = async (bytes: Uint8Array, width: number): Promise<Uint8Array<ArrayBuffer>> => {
    const encoded = await sharp(bytes, { limitInputPixels: maxImagePixels })
        // Camera images carry their rotation in EXIF; baking it in keeps the stored image upright.
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: webpQuality })
        .toBuffer();

    // Hono's `.body()` needs an ArrayBuffer-backed view rather than the shared Buffer pool.
    return new Uint8Array(encoded);
};

const readCached = async (path: string): Promise<Uint8Array<ArrayBuffer> | null> => {
    try {
        return new Uint8Array(await readFile(path));
    } catch {
        return null;
    }
};

const writeCached = async (path: string, bytes: Uint8Array): Promise<void> => {
    await mkdir(dirname(path), { recursive: true });

    // Rename is atomic on one filesystem, so a reader never picks up a half-written image.
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, bytes);
    await rename(temporary, path);
};

const unlinkQuietly = async (path: string): Promise<void> => {
    await unlink(path).catch(() => null);
};

const thumbnailCachePath = (id: string): string => resolve(thumbnailsDir, `${id}.webp`);

const faviconCacheKey = (hostname: string): string => createHash("sha256").update(hostname).digest("hex");

const faviconCachePath = (hostname: string): string => resolve(faviconsDir, `${faviconCacheKey(hostname)}.webp`);

const saveThumbnail = async (id: string, source: Uint8Array): Promise<Uint8Array<ArrayBuffer>> => {
    const webp = await renderWebp(source, thumbnailWidthPx);
    await writeCached(thumbnailCachePath(id), webp);

    return webp;
};

const saveFavicon = async (hostname: string, source: Uint8Array): Promise<Uint8Array<ArrayBuffer>> => {
    const webp = await renderWebp(source, faviconWidthPx);
    await writeCached(faviconCachePath(hostname), webp);

    return webp;
};

const readThumbnail = (id: string): Promise<Uint8Array<ArrayBuffer> | null> => readCached(thumbnailCachePath(id));

const readFavicon = (hostname: string): Promise<Uint8Array<ArrayBuffer> | null> =>
    readCached(faviconCachePath(hostname));

// An X render already arrived as an image, so it only needs encoding; page thumbnails still need a
// download through the SSRF guard first.
const cacheRenderedThumbnail = (id: string, png: Uint8Array): Promise<Uint8Array<ArrayBuffer>> =>
    saveThumbnail(id, png);

const cacheRemoteThumbnail = async (id: string, imageUrl: string): Promise<Uint8Array<ArrayBuffer> | null> => {
    const image = await fetchValidImage(imageUrl);

    return image ? saveThumbnail(id, image.bytes) : null;
};

const googleFaviconUrl = (hostname: string): string => {
    const url = new URL("https://www.google.com/s2/favicons");
    url.searchParams.set("domain", hostname);
    url.searchParams.set("sz", "128");

    return url.href;
};

// A stored favicon may be SVG, which cannot be served from this origin, and a stored file can still
// be unusable; Google renders both cases into a raster PNG that fits the card.
const faviconSourceUrls = (faviconUrl: string | null, hostname: string): [string, ...string[]] => {
    const google = googleFaviconUrl(hostname);

    return faviconUrl && !faviconUrl.endsWith(".svg") ? [faviconUrl, google] : [google];
};

/* oxlint-disable no-await-in-loop -- Sources are fallbacks in priority order; fetching them in parallel wastes requests. */
const cacheRemoteFavicon = async (
    hostname: string,
    faviconUrl: string | null
): Promise<Uint8Array<ArrayBuffer> | null> => {
    for (const source of faviconSourceUrls(faviconUrl, hostname)) {
        try {
            const image = await fetchValidImage(source);

            if (image) {
                return await saveFavicon(hostname, image.bytes);
            }
        } catch {
            // A source that cannot be fetched or decoded falls through to the next one.
        }
    }

    return null;
};
/* oxlint-enable no-await-in-loop */

const deleteThumbnail = (id: string): Promise<void> => unlinkQuietly(thumbnailCachePath(id));

const deleteFavicon = (hostname: string): Promise<void> => unlinkQuietly(faviconCachePath(hostname));

export {
    cacheRemoteFavicon,
    cacheRemoteThumbnail,
    cacheRenderedThumbnail,
    deleteFavicon,
    deleteThumbnail,
    faviconCacheKey,
    googleFaviconUrl,
    readFavicon,
    readThumbnail,
    renderWebp
};
