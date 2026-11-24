import { afterEach, describe, expect, it, vi } from "vitest";
import { publicFetch } from "./publicFetch";

const resolvedAddress = "93.184.216.34";
const loopbackAddress = "127.0.0.1";
const ipv4Family = 4;
const okStatus = 200;

const resolveTo =
    (addresses: Array<{ address: string; family: number }>) =>
    (): Promise<Array<{ address: string; family: number }>> =>
        Promise.resolve(addresses);

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("publicFetch", () => {
    it("dials the validated address while keeping the original host", async () => {
        const fetchMock = vi.fn((_input: string | URL | Request, _init?: RequestInit) =>
            Promise.resolve(new Response("ok", { status: okStatus }))
        );

        vi.stubGlobal("fetch", fetchMock);

        await publicFetch(
            new URL("https://example.com/path"),
            {
                headers: {
                    accept: "text/html"
                }
            },
            resolveTo([
                {
                    address: resolvedAddress,
                    family: ipv4Family
                }
            ])
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
    });

    it("rejects a hostname when any resolved address is private", async () => {
        const fetchMock = vi.fn(() => Promise.resolve(new Response("ok", { status: okStatus })));

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
                        address: loopbackAddress,
                        family: ipv4Family
                    }
                ])
            )
        ).rejects.toThrow();

        expect(fetchMock).not.toHaveBeenCalled();
    });
});
