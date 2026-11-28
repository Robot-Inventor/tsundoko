import { parseContentType } from "./mediaType";
import { parseImageUrl } from "./bookmarkUrl";
import { publicFetch } from "./publicFetch";
import { readCappedBody } from "./cappedBody";
import { userAgent } from "./userAgent";

const fetchTimeout = 8000;
const maxImageBytes = 10_485_760;

interface RemoteImage {
    bytes: Uint8Array<ArrayBuffer>;
    mediaType: string;
}

// Fetches a stored image URL through the SSRF guard; returns null when the URL is malformed or the
// response is not a usable raster image.
const fetchValidImage = async (imageUrl: string): Promise<RemoteImage | null> => {
    const url = parseImageUrl(imageUrl);

    if (!url) {
        return null;
    }

    // One deadline covers every hop; a redirect chain cannot extend the request indefinitely.
    const { response } = await publicFetch(url, {
        credentials: "omit",
        headers: {
            accept: "image/*",
            "user-agent": userAgent
        },
        signal: AbortSignal.timeout(fetchTimeout)
    });

    const contentType = parseContentType(response.headers.get("content-type"));
    // Browsers execute scripts in SVG loaded as a document, so serving it from the app origin would allow
    // stored XSS; only raster images are proxied.
    const usable =
        response.ok && contentType?.type === "image" && !contentType.subtype.startsWith("svg") && response.body;

    if (!usable) {
        await response.body?.cancel();

        return null;
    }

    // Hono's `.body()` only accepts `Uint8Array<ArrayBuffer>`, so the bytes are copied out of the
    // Buffer, which is typed as `ArrayBufferLike`, into a plain `Uint8Array`.
    return {
        bytes: new Uint8Array(await readCappedBody(response.body, maxImageBytes)),
        mediaType: contentType.essence
    };
};

export { fetchValidImage };
