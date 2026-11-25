import { describe, expect, it, vi } from "vitest";
import { getPreview } from "./preview";
import { isPublicAddress } from "./publicAddress";
import { publicFetch } from "./publicFetch";

const redirectResponse = (location: string): Response =>
    new Response(null, {
        headers: {
            location
        },
        status: 302
    });

describe("public address guard", () => {
    it.each([
        "0.0.0.0",
        "10.1.2.3",
        "100.64.0.1",
        "127.0.0.1",
        "169.254.169.254",
        "172.16.0.1",
        "192.0.0.1",
        "192.0.2.1",
        "192.88.99.1",
        "192.168.1.1",
        "198.18.0.1",
        "198.51.100.1",
        "203.0.113.1",
        "224.0.0.1",
        "240.0.0.1",
        "::",
        "::1",
        "::ffff:127.0.0.1",
        "::ffff:7f00:1",
        "::ffff:8.8.8.8",
        "::127.0.0.1",
        "64:ff9b::a00:1",
        "64:ff9b:1::1",
        "2001::1",
        "2001:2::1",
        "2001:db8::1",
        "2002:7f00:1::",
        "3fff::1",
        "fc00::1",
        "fec0::1",
        "fe80::1",
        "ff02::1"
    ])("blocks %s", (address) => {
        expect(isPublicAddress(address)).toBe(false);
    });

    it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2400:cb00:2048::1", "2001:4860:4860::8888"])(
        "allows %s",
        (address) => {
            expect(isPublicAddress(address)).toBe(true);
        }
    );

    it("treats a hostname as blocked input", () => {
        expect(isPublicAddress("example.com")).toBe(false);
    });
});

describe("publicFetch", () => {
    it("refuses a loopback URL before connecting", async () => {
        await expect(publicFetch(new URL("http://127.0.0.1:1/"))).rejects.toThrow();
    });

    it("refuses a hostname that resolves to loopback", async () => {
        await expect(publicFetch(new URL("http://localhost/"))).rejects.toThrow();
    });
});

describe("redirect hops", () => {
    it("refuses a redirect to a private address without following it", async () => {
        const fetchMock = vi.fn(() => Promise.resolve(redirectResponse("http://169.254.169.254/latest/meta-data")));

        vi.stubGlobal("fetch", fetchMock);

        try {
            await expect(getPreview(new URL("https://93.184.216.34/"))).rejects.toThrow();
            expect(fetchMock).toHaveBeenCalledOnce();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
