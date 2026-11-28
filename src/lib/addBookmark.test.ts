import { afterEach, describe, expect, it, vi } from "vitest";
import { requestBookmark } from "./addBookmark";

const unauthorized = 401;
const forbidden = 403;

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("requestBookmark", () => {
    it.each([unauthorized, forbidden])("reports an auth failure on HTTP %i", async (status) => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.resolve(new Response(null, { status })))
        );

        const result = await requestBookmark(new URL("https://example.com/article"));

        expect(result).toEqual({ failure: "auth" });
    });
});
