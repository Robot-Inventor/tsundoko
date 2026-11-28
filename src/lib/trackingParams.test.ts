import { describe, expect, it } from "vitest";
import { removeTrackingParams } from "./trackingParams";
import { trackingParamRules } from "./trackingParamRules";

const clean = (href: string): string => {
    const url = new URL(href);
    removeTrackingParams(url);

    return url.href;
};

describe("removeTrackingParams", () => {
    it("excludes the rules borrowed from AdGuard under GPL-3.0", () => {
        const gplParamNames = ["_zucks_suid", "ysclid", "cjevent", "wickedid"] as const;

        for (const name of gplParamNames) {
            expect(trackingParamRules).not.toContain(`$removeparam=${name}`);
        }
    });

    it("removes common tracking parameters and keeps functional ones", () => {
        expect(clean("https://example.com/article?id=42&utm_source=newsletter&fbclid=abc&gclid=def")).toBe(
            "https://example.com/article?id=42"
        );
    });

    it("removes parameters matched by regex rules", () => {
        expect(clean("https://example.com/page?itm_source=email&itm_medium=header&keep=1")).toBe(
            "https://example.com/page?keep=1"
        );
    });

    it("applies domain-specific rules only to the matching host", () => {
        expect(clean("https://www.salming.com/product?trackID=79064280&keep=1")).toBe(
            "https://www.salming.com/product?keep=1"
        );

        expect(clean("https://example.org/product?trackID=79064280&keep=1")).toBe(
            "https://example.org/product?trackID=79064280&keep=1"
        );
    });

    it("applies path-specific rules only to matching paths", () => {
        expect(clean("https://www.youtube.com/live/4FUyWqF4TDQ?si=145P63cF_jhs5d_C")).toBe(
            "https://www.youtube.com/live/4FUyWqF4TDQ"
        );

        expect(clean("https://www.youtube.com/watch?v=4FUyWqF4TDQ&si=145P63cF_jhs5d_C")).toBe(
            "https://www.youtube.com/watch?v=4FUyWqF4TDQ&si=145P63cF_jhs5d_C"
        );

        expect(clean("https://example.com/live/abc?si=xyz")).toBe("https://example.com/live/abc?si=xyz");

        expect(clean("https://www.facebook.com/ads?session_id=abc&keep=1")).toBe("https://www.facebook.com/ads?keep=1");
    });

    it("respects exception rules with a path", () => {
        expect(clean("https://www.amazon.com/gp/slredirect/picassoRedirect.html?linkCode=abc&utm_source=x")).toBe(
            "https://www.amazon.com/gp/slredirect/picassoRedirect.html?linkCode=abc&utm_source=x"
        );
    });

    it("applies host-entity rules to the domain and its subdomains", () => {
        expect(clean("https://www.amazon.com/dp/B123?th=1&linkCode=abc")).toBe("https://www.amazon.com/dp/B123");

        expect(clean("https://www.paypal.com/myaccount?ppid=abc&keep=1")).toBe(
            "https://www.paypal.com/myaccount?keep=1"
        );
    });

    it("respects hostname exclusions on global rules", () => {
        expect(clean("https://www.nytimes.com/article?smid=fb-nytimes&keep=1")).toBe(
            "https://www.nytimes.com/article?keep=1"
        );

        expect(clean("https://www.amazon.com/dp/B123?smid=ATVPDKIKX0DER&keep=1")).toBe(
            "https://www.amazon.com/dp/B123?smid=ATVPDKIKX0DER&keep=1"
        );
    });

    it("respects exception rules", () => {
        expect(clean("https://example.com/page?__s=abc&keep=1")).toBe("https://example.com/page?keep=1");
        expect(clean("https://www.facebook.com/page?__s=abc&keep=1")).toBe(
            "https://www.facebook.com/page?__s=abc&keep=1"
        );
    });

    it("keeps every parameter on an exception domain", () => {
        expect(clean("https://archive.today/abc?utm_source=x&fbclid=y")).toBe(
            "https://archive.today/abc?utm_source=x&fbclid=y"
        );
    });

    it("keeps repeated functional parameters and removes repeated tracking parameters", () => {
        expect(clean("https://example.com/page?foo=1&foo=2&utm_source=a&utm_source=b")).toBe(
            "https://example.com/page?foo=1&foo=2"
        );
    });

    it("leaves a URL without a query string untouched", () => {
        expect(clean("https://example.com/page?id=42#section")).toBe("https://example.com/page?id=42#section");
    });
});
