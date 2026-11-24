import { describe, expect, it } from "vitest";
import { getGravatarUrl } from "./gravatar";

const normalizedAddress = "someone@somewhere.com";

describe("getGravatarUrl", () => {
    it("normalises the address before hashing it", async () => {
        expect(await getGravatarUrl("  Someone@Somewhere.com ")).toBe(await getGravatarUrl(normalizedAddress));
    });

    it("hashes the normalised address with SHA-256", async () => {
        expect(await getGravatarUrl(normalizedAddress)).toBe(
            "https://gravatar.com/avatar/f9b31680ba13eae8e8f293d324237626ef587beabef07576dce717f700fd44ba?d=404&s=64"
        );
    });
});
