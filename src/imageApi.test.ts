import { describe, expect, it, vi } from "vitest";
import type { AuthEnv } from "./authMiddleware";
import { Hono } from "hono";
import { httpStatus } from "./lib/httpStatus";

const bookmarkId = "00000000-0000-4000-8000-000000000000";

const { proxiedBytes, fetchValidImage, getBookmarkImageUrls } = vi.hoisted(() => {
    const hostname = "favicon-fallback.example";
    const pageFaviconUrl = `https://${hostname}/favicon.png`;
    // Sharp rejects these bytes, so the cache fill fails even though the browser can render them.
    const bytes = new Uint8Array(Buffer.from("not an image"));

    return {
        fetchValidImage: vi.fn((url: string) =>
            Promise.resolve(
                url.startsWith("https://www.google.com/s2/favicons")
                    ? {
                          bytes,
                          mediaType: "image/png"
                      }
                    : null
            )
        ),
        getBookmarkImageUrls: vi.fn(() =>
            Promise.resolve({
                faviconUrl: pageFaviconUrl,
                thumbnailUrl: null,
                url: `https://${hostname}/page`
            })
        ),
        proxiedBytes: bytes
    };
});

vi.mock("./lib/remoteImage", () => ({ fetchValidImage }));
vi.mock("./db/bookmarks", () => ({ getBookmarkImageUrls }));

const { imageApi } = await import("./imageApi");

const buildApp = (): Hono<AuthEnv> =>
    new Hono<AuthEnv>()
        .use("*", async (context, next) => {
            context.set("userId", "test-user");

            return next();
        })
        .route("/", imageApi);

describe("favicon proxy fallback", () => {
    it("serves Google's favicon when the page favicon cannot fill the cache", async () => {
        const response = await buildApp().request(`/api/favicon?id=${bookmarkId}`);

        expect(response.status).toBe(httpStatus.ok);
        expect(response.headers.get("content-type")).toBe("image/png");
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(proxiedBytes);
    });
});
