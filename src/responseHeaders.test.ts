import { type SecurityEnv, responseHeaders } from "./responseHeaders";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { httpStatus } from "./lib/httpStatus";

const buildApp = (): Hono<SecurityEnv> =>
    new Hono<SecurityEnv>().use("*", responseHeaders).get("/", (context) => context.text("ok"));

const contentSecurityPolicy = (nonce: string): string =>
    `default-src 'self'; img-src 'self' data: https://gravatar.com https://secure.gravatar.com; style-src 'self' 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`;

const nonceFrom = (response: Response): string => {
    const policy = response.headers.get("content-security-policy") ?? "";

    return /'nonce-(?<nonce>[^']+)'/u.exec(policy)?.groups?.nonce ?? "";
};

describe("response headers", () => {
    it("sets the security policy on a plain HTTP response without HSTS", async () => {
        const response = await buildApp().request("http://localhost/");
        const nonce = nonceFrom(response);

        expect(nonce).not.toBe("");
        expect(response.headers.get("content-security-policy")).toBe(contentSecurityPolicy(nonce));
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(response.headers.get("referrer-policy")).toBe("no-referrer");
        expect(response.headers.get("strict-transport-security")).toBeNull();
    });

    it("keeps the headers on an error response", async () => {
        const response = await buildApp().request("http://localhost/missing");
        const nonce = nonceFrom(response);

        expect(nonce).not.toBe("");
        expect(response.status).toBe(httpStatus.notFound);
        expect(response.headers.get("content-security-policy")).toBe(contentSecurityPolicy(nonce));
    });

    it("uses a fresh nonce for every response", async () => {
        const app = buildApp();
        const first = await app.request("http://localhost/");
        const second = await app.request("http://localhost/");

        expect(nonceFrom(first)).not.toBe(nonceFrom(second));
    });

    it("sets HSTS when the proxy reports HTTPS", async () => {
        const response = await buildApp().request("http://localhost/", {
            headers: {
                "x-forwarded-proto": "https"
            }
        });

        expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
    });

    it("sets HSTS when the proxy reports a forwarded chain", async () => {
        const response = await buildApp().request("http://localhost/", {
            headers: {
                "x-forwarded-proto": "https,http"
            }
        });

        expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
    });

    it("opts in to the color-scheme hint", async () => {
        const response = await buildApp().request("http://localhost/");

        expect(response.headers.get("accept-ch")).toBe("Sec-CH-Prefers-Color-Scheme");
    });
});
