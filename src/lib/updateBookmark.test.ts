import { afterEach, describe, expect, it, vi } from "vitest";
import { requestBookmarkUpdate } from "./updateBookmark";

const unauthorized = 401;
const forbidden = 403;

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("requestBookmarkUpdate", () => {
    it.each([unauthorized, forbidden])("reports an auth failure on HTTP %i", async (status) => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.resolve(new Response(null, { status })))
        );

        const result = await requestBookmarkUpdate({
            id: "bookmark-id",
            tags: [],
            title: "Title"
        });

        expect(result).toEqual({ failure: "auth" });
    });
});
