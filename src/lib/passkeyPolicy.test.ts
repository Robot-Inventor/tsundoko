import { describe, expect, it } from "vitest";
import { getPasskeyEditingDeadline, isPasskeyEditingAllowed, resolvePasskeyName } from "./passkeyPolicy";

const googleAaguid = "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4";
const anonymousAaguid = "00000000-0000-0000-0000-000000000000";

describe("resolvePasskeyName", () => {
    it("keeps a name the user saved", () => {
        expect(resolvePasskeyName("自宅のPC", googleAaguid)).toBe("自宅のPC");
    });

    it("derives the authenticator name from the AAGUID when none was saved", () => {
        expect(resolvePasskeyName(null, googleAaguid.toUpperCase())).toBe("Google Password Manager");
    });

    it("falls back when the authenticator cannot be identified", () => {
        expect(resolvePasskeyName(null, anonymousAaguid)).toBe("Passkey");
        expect(resolvePasskeyName("  ", null)).toBe("Passkey");
    });
});

describe("passkey editing window", () => {
    const signedInAt = new Date("2026-01-01T00:00:00.000Z");

    it("closes after fifteen minutes", () => {
        expect(getPasskeyEditingDeadline(signedInAt).toISOString()).toBe("2026-01-01T00:15:00.000Z");
    });

    it("allows changes just before the deadline", () => {
        const deadline = getPasskeyEditingDeadline(signedInAt);

        expect(isPasskeyEditingAllowed(deadline, new Date("2026-01-01T00:14:59.000Z"))).toBe(true);
    });

    it("rejects changes at or after the deadline", () => {
        const deadline = getPasskeyEditingDeadline(signedInAt);

        expect(isPasskeyEditingAllowed(deadline, new Date("2026-01-01T00:15:00.000Z"))).toBe(false);
        expect(isPasskeyEditingAllowed(deadline, new Date("2026-01-01T00:20:00.000Z"))).toBe(false);
    });
});
