import { type SecurityEnv, responseHeaders } from "./responseHeaders";
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { serveAppHtml } from "./spaStatic";

vi.mock("@hono/bun", () => ({
    serveStatic: () => (): Response => new Response(null)
}));

vi.mock("node:fs/promises", () => ({
    readFile: (): Promise<string> => Promise.resolve('<html><head data-test="head"></head><body></body></html>')
}));

const buildApp = (): Hono<SecurityEnv> => new Hono<SecurityEnv>().use("*", responseHeaders).get("*", serveAppHtml);

const nonceFrom = (response: Response): string => {
    const policy = response.headers.get("content-security-policy") ?? "";

    return /'nonce-(?<nonce>[^']+)'/u.exec(policy)?.groups?.nonce ?? "";
};

describe("serveAppHtml", () => {
    it("embeds the policy nonce in the document", async () => {
        const response = await buildApp().request("http://localhost/tags/typescript");
        const nonce = nonceFrom(response);

        expect(nonce).not.toBe("");
        expect(await response.text()).toContain(`<meta name="csp-nonce" content="${nonce}" />`);
    });
});
