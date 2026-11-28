import { describe, expect, it } from "vitest";
import {
    normalizeTokenPermissions,
    parseStoredTokenPermissions,
    permissionsToScopes,
    scopesToPermissions
} from "./tokenPermissions";

describe("token permissions", () => {
    it("adds read whenever another permission is selected", () => {
        expect(normalizeTokenPermissions(["delete"])).toEqual({ bookmarks: ["read", "delete"] });
    });

    it("keeps an empty selection empty", () => {
        expect(normalizeTokenPermissions([])).toEqual({ bookmarks: [] });
    });

    it("round-trips permissions through scopes", () => {
        const permissions = normalizeTokenPermissions(["read", "write"]);

        expect(scopesToPermissions(permissionsToScopes(permissions))).toEqual(permissions);
    });

    it("grants nothing for unreadable stored data", () => {
        expect(parseStoredTokenPermissions("not json")).toEqual({ bookmarks: [] });
        expect(parseStoredTokenPermissions('{"bookmarks":["admin"]}')).toEqual({ bookmarks: [] });
        expect(parseStoredTokenPermissions(null)).toEqual({ bookmarks: [] });
    });
});
