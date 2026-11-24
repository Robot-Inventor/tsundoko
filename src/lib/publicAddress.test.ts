import { describe, expect, it } from "vitest";
import { isPublicAddress } from "./publicAddress";
import { publicFetch } from "./publicFetch";

describe("public address guard", () => {
    it.each([
        "0.0.0.0",
        "10.1.2.3",
        "100.64.0.1",
        "127.0.0.1",
        "169.254.169.254",
        "172.16.0.1",
        "192.168.1.1",
        "198.18.0.1",
        "224.0.0.1",
        "240.0.0.1",
        "::",
        "::1",
        "fc00::1",
        "fe80::1",
        "ff02::1",
        "::ffff:127.0.0.1",
        "::ffff:7f00:1",
        "::ffff:8.8.8.8",
        "::127.0.0.1"
    ])("blocks %s", (address) => {
        expect(isPublicAddress(address)).toBe(false);
    });

    it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows %s", (address) => {
        expect(isPublicAddress(address)).toBe(true);
    });

    it("treats a hostname as blocked input", () => {
        expect(isPublicAddress("example.com")).toBe(false);
    });
});

describe("publicFetch", () => {
    it("refuses a loopback URL before connecting", async () => {
        await expect(publicFetch(new URL("http://127.0.0.1:1/"))).rejects.toThrow();
    });
});
