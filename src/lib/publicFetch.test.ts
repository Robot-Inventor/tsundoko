import { afterEach, describe, expect, it, vi } from "vitest";
import { publicFetch } from "./publicFetch";

const resolvedAddress = "93.184.216.34";
const ipv4Family = 4;
const okStatus = 200;
const initialRequestPlusOneRedirect = 2;
// The initial request plus every followed redirect.
const initialRequestPlusAllRedirects = 6;

const resolveTo =
    (addresses: Array<{ address: string; family: number }>) =>
    (): Promise<Array<{ address: string; family: number }>> =>
        Promise.resolve(addresses);

const resolvePublic = resolveTo([
    {
        address: resolvedAddress,
        family: ipv4Family
    }
]);

const redirectResponse = (location: string): Response =>
    new Response(null, {
        headers: {
            location
        },
        status: 302
    });

const okResponse = (): Response => new Response("ok", { status: okStatus });

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("publicFetch", () => {
    it("dials the validated address while keeping the original host", async () => {
        const fetchMock = vi.fn((_input: string | URL | Request, _init?: RequestInit) => Promise.resolve(okResponse()));

        vi.stubGlobal("fetch", fetchMock);

        const { url } = await publicFetch(
            new URL("https://example.com/path"),
            {
                headers: {
                    accept: "text/html"
                }
            },
            resolvePublic
        );

        const [call] = fetchMock.mock.calls;
        const [target, options] = call;

        if (!(target instanceof URL)) {
            throw new Error("fetch did not receive a URL");
        }

        expect(target.href).toBe(`https://${resolvedAddress}/path`);
        expect(new Headers(options?.headers).get("host")).toBe("example.com");
        expect(options).toMatchObject({
            proxy: false,
            redirect: "manual",
            tls: {
                serverName: "example.com"
            }
        });

        expect(url.href).toBe("https://example.com/path");
    });

    it("rejects a hostname when any resolved address is private", async () => {
        const fetchMock = vi.fn(() => Promise.resolve(okResponse()));

        vi.stubGlobal("fetch", fetchMock);

        await expect(
            publicFetch(
                new URL("https://example.com/"),
                {},
                resolveTo([
                    {
                        address: resolvedAddress,
                        family: ipv4Family
                    },
                    {
                        address: "127.0.0.1",
                        family: ipv4Family
                    }
                ])
            )
        ).rejects.toThrow();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("follows a redirect after re-validating the destination", async () => {
        const responses = [redirectResponse("https://example.net/next"), okResponse()];
        const fetchMock = vi.fn((_input: string | URL | Request, _init?: RequestInit) =>
            Promise.resolve(responses.shift() ?? okResponse())
        );

        vi.stubGlobal("fetch", fetchMock);

        const { response, url } = await publicFetch(new URL("https://example.com/"), {}, resolvePublic);

        expect(url.href).toBe("https://example.net/next");
        expect(response.status).toBe(okStatus);
        expect(fetchMock).toHaveBeenCalledTimes(initialRequestPlusOneRedirect);

        const [, redirectedCall] = fetchMock.mock.calls;
        const [target, options] = redirectedCall;

        if (!(target instanceof URL)) {
            throw new Error("fetch did not receive a URL");
        }

        expect(target.hostname).toBe(resolvedAddress);
        expect(new Headers(options?.headers).get("host")).toBe("example.net");
    });
});

describe("publicFetch redirect guard", () => {
    it("refuses a redirect to a private address without dialing it", async () => {
        const fetchMock = vi.fn(() => Promise.resolve(redirectResponse("http://169.254.169.254/latest/meta-data")));

        vi.stubGlobal("fetch", fetchMock);

        await expect(publicFetch(new URL("https://example.com/"), {}, resolvePublic)).rejects.toThrow();

        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("refuses a redirect off the http(s) schemes", async () => {
        const fetchMock = vi.fn(() => Promise.resolve(redirectResponse("file:///etc/passwd")));

        vi.stubGlobal("fetch", fetchMock);

        await expect(publicFetch(new URL("https://example.com/"), {}, resolvePublic)).rejects.toThrow();

        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("refuses a redirect with embedded credentials", async () => {
        const fetchMock = vi.fn(() => Promise.resolve(redirectResponse("https://user:pass@example.net/")));

        vi.stubGlobal("fetch", fetchMock);

        await expect(publicFetch(new URL("https://example.com/"), {}, resolvePublic)).rejects.toThrow();

        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("stops following redirects at the hop limit", async () => {
        const fetchMock = vi.fn(() => Promise.resolve(redirectResponse("https://example.com/loop")));

        vi.stubGlobal("fetch", fetchMock);

        await expect(publicFetch(new URL("https://example.com/"), {}, resolvePublic)).rejects.toThrow();

        expect(fetchMock).toHaveBeenCalledTimes(initialRequestPlusAllRedirects);
    });
});
