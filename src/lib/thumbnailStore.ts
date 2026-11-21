import { mkdir, readFile, writeFile } from "node:fs/promises";

// Fixed storage root for locally saved thumbnails. Relative to the working directory
// the server is started from (the repository root), and kept out of version control.
const dataRoot = "data";
const thumbnailsDirName = "thumbnails";
const thumbnailsDir = `${dataRoot}/${thumbnailsDirName}`;

const saveThumbnail = async (id: string, png: Uint8Array): Promise<string> => {
    await mkdir(thumbnailsDir, { recursive: true });

    const file = `${thumbnailsDirName}/${id}.png`;
    await writeFile(`${dataRoot}/${file}`, png);

    return file;
};

const readThumbnail = async (file: string): Promise<Uint8Array<ArrayBuffer> | null> => {
    // The column is only written by saveThumbnail, but a tampered value must not escape the directory.
    if (!file.startsWith(`${thumbnailsDirName}/`) || file.includes("..")) {
        return null;
    }

    try {
        // The copy constructor allocates a fresh ArrayBuffer, which Hono's `.body()` requires.
        return new Uint8Array(await readFile(`${dataRoot}/${file}`));
    } catch {
        // A missing or unreadable file lets the caller fall back to the remote thumbnail URL.
        return null;
    }
};

export { readThumbnail, saveThumbnail };
