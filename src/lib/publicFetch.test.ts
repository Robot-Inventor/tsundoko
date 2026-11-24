import { afterEach, describe, expect, it, vi } from "vitest";
import { publicFetch } from "./publicFetch";

const resolvedAddress = "93.184.216.34";
const ipv4Family = 4;
const okStatus = 200;

vi.mock("node:dns/promises", (): { lookup: () => Promise<Array<{ address: string; family: number }>> } => ({
    lookup: () =>
        Promise.resolve([
            {
                address: resolvedAddress,
                family: ipv4Family
            }
        ])
}));

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("publicFetch", () => {
    it("dials the validated address while keeping the original host", async () => {
        const fetchMock = vi.fn((_input: string | URL | Request, _init?: RequestInit) =>
            Promise.resolve(new Response("ok", { status: okStatus }))
        );

        vi.stubGlobal("fetch", fetchMock);

        await publicFetch(new URL("https://example.com/path"), {
            headers: {
                accept: "text/html"
            }
        });

        const [call] = fetchMock.mock.calls;
        const [target, options] = call;

        if (!(target instanceof URL)) {
            throw new Error("fetch did not receive a URL");
        }

        expect(target.href).toBe(`https://${resolvedAddress}/path`);
        expect(new Headers(options?.headers).get("host")).toBe("example.com");
    });
});
