import { describe, expect, it } from "vitest";
import { normalizeBookmarkUrl } from "./normalizeBookmarkUrl";

describe("normalizeBookmarkUrl", () => {
    it("drops X and general tracking parameters but keeps other query parameters", () => {
        const url = new URL("https://x.com/user/status/123?s=20&a=1&t=abc&utm_source=share");

        expect(normalizeBookmarkUrl(url)).toBe("https://x.com/user/status/123?t=abc");
    });

    it("canonicalises every X host to https://x.com", () => {
        const hosts = [
            "x.com",
            "www.x.com",
            "mobile.x.com",
            "twitter.com",
            "www.twitter.com",
            "mobile.twitter.com"
        ] as const;

        for (const host of hosts) {
            expect(normalizeBookmarkUrl(new URL(`http://${host}/user?a=1`))).toBe("https://x.com/user");
        }
    });

    it("leaves other sites untouched apart from the fragment", () => {
        const url = new URL("http://example.com/path?a=1&s=2&keep=3#section");

        expect(normalizeBookmarkUrl(url)).toBe("http://example.com/path?a=1&s=2&keep=3");
    });

    it("removes every lowercase a and s but keeps uppercase keys", () => {
        const url = new URL("https://x.com/explore?a=1&s=2&a=3&A=4&S=5");

        expect(normalizeBookmarkUrl(url)).toBe("https://x.com/explore?A=4&S=5");
    });
});

describe("Amazon product URLs", () => {
    it("reduces a product page with a title slug, path ref, query, and fragment to its ASIN", () => {
        const url = new URL(
            "https://www.amazon.co.jp/QuietComfort-Headphones/dp/B0B67KQ885/ref=sr_1_3?tag=site-22&th=1&psc=1#detail"
        );

        expect(normalizeBookmarkUrl(url)).toBe("https://www.amazon.co.jp/dp/B0B67KQ885");
    });

    it("canonicalises the legacy /gp/product/ form to /dp/", () => {
        const url = new URL("https://www.amazon.com/gp/product/B011BZ2QSG?smid=A3KY1G6IMKRKPX&psc=1");

        expect(normalizeBookmarkUrl(url)).toBe("https://www.amazon.com/dp/B011BZ2QSG");
    });

    it("drops a trailing slash and forces https while keeping the storefront host", () => {
        const url = new URL("http://amazon.de/dp/B0CCNKFGV5/");

        expect(normalizeBookmarkUrl(url)).toBe("https://amazon.de/dp/B0CCNKFGV5");
    });

    it("recognises every storefront in the shared domain list", () => {
        const domains = [
            "amazon.com",
            "amazon.de",
            "amazon.in",
            "amazon.co.jp",
            "amazon.co.uk",
            "amazon.ca",
            "amazon.com.br",
            "amazon.com.mx",
            "amazon.it",
            "amazon.fr",
            "amazon.es",
            "amazon.com.au"
        ] as const;

        for (const domain of domains) {
            expect(normalizeBookmarkUrl(new URL(`https://www.${domain}/dp/B0CCNKFGV5`))).toBe(
                `https://www.${domain}/dp/B0CCNKFGV5`
            );
        }
    });

    it("leaves a non-product Amazon page untouched apart from the fragment", () => {
        const url = new URL("https://www.amazon.co.jp/gp/search?k=book#results");

        expect(normalizeBookmarkUrl(url)).toBe("https://www.amazon.co.jp/gp/search?k=book");
    });

    it("does not treat the mobile /gp/aw/d/ form as a product page", () => {
        const url = new URL("https://www.amazon.com/gp/aw/d/B0CCNKFGV5?psc=1");

        expect(normalizeBookmarkUrl(url)).toBe("https://www.amazon.com/gp/aw/d/B0CCNKFGV5?psc=1");
    });

    it("does not treat Amazon Music hosts as storefronts", () => {
        const url = new URL("https://music.amazon.co.jp/dp/B0CCNKFGV5?psc=1");

        expect(normalizeBookmarkUrl(url)).toBe("https://music.amazon.co.jp/dp/B0CCNKFGV5?psc=1");
    });

    it("keeps a lowercase ASIN as written", () => {
        const url = new URL("https://www.amazon.co.jp/dp/b0fpphyw21?th=1");

        expect(normalizeBookmarkUrl(url)).toBe("https://www.amazon.co.jp/dp/b0fpphyw21");
    });
});
