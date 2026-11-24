import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { httpStatus } from "./lib/httpStatus";
import { responseHeaders } from "./responseHeaders";

const contentSecurityPolicy =
    "default-src 'self'; img-src 'self' data: https://gravatar.com https://secure.gravatar.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

const buildApp = (): Hono => new Hono().use("*", responseHeaders).get("/", (context) => context.text("ok"));

describe("response headers", () => {
    it("sets the security policy on a plain HTTP response without HSTS", async () => {
        const response = await buildApp().request("http://localhost/");

        expect(response.headers.get("content-security-policy")).toBe(contentSecurityPolicy);
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(response.headers.get("referrer-policy")).toBe("no-referrer");
        expect(response.headers.get("strict-transport-security")).toBeNull();
    });

    it("keeps the headers on an error response", async () => {
        const response = await buildApp().request("http://localhost/missing");

        expect(response.status).toBe(httpStatus.notFound);
        expect(response.headers.get("content-security-policy")).toBe(contentSecurityPolicy);
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
