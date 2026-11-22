import { dirname, isAbsolute, relative, resolve } from "node:path";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";

// Fixed storage root for locally saved thumbnails. Relative to the working directory
// the server is started from (the repository root), and kept out of version control.
const dataRoot = "data";
const thumbnailsDirName = "thumbnails";
const thumbnailsDir = resolve(dataRoot, thumbnailsDirName);

const getThumbnailPath = (file: string): string | null => {
    // Resolve both sides so separators, traversal, or an absolute DB value cannot escape the directory.
    const absolute = resolve(dataRoot, file);
    const fromThumbnailsDir = relative(thumbnailsDir, absolute);

    const escapesDirectory =
        isAbsolute(fromThumbnailsDir) || fromThumbnailsDir.startsWith("..") || dirname(fromThumbnailsDir) !== ".";

    if (escapesDirectory) {
        return null;
    }

    return absolute;
};

const saveThumbnail = async (id: string, png: Uint8Array): Promise<string> => {
    await mkdir(thumbnailsDir, { recursive: true });

    const file = `${thumbnailsDirName}/${id}.png`;
    await writeFile(resolve(dataRoot, file), png);

    return file;
};

const readThumbnail = async (file: string): Promise<Uint8Array<ArrayBuffer> | null> => {
    const path = getThumbnailPath(file);

    if (!path) {
        return null;
    }

    try {
        // The copy constructor allocates a fresh ArrayBuffer, which Hono's `.body()` requires.
        return new Uint8Array(await readFile(path));
    } catch {
        // A missing or unreadable file lets the caller fall back to the remote thumbnail URL.
        return null;
    }
};

const deleteThumbnail = async (file: string): Promise<void> => {
    const path = getThumbnailPath(file);

    if (path) {
        await unlink(path);
    }
};

export { deleteThumbnail, readThumbnail, saveThumbnail };
