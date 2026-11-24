import { describe, expect, it } from "vitest";
import { parseTheme } from "./manifest";

describe("parseTheme", () => {
    it("uses the client hint", () => {
        expect(parseTheme({ hint: "dark" })).toBe("dark");
        expect(parseTheme({ cookie: "dark", hint: "light" })).toBe("light");
    });

    it("accepts a quoted hint", () => {
        expect(parseTheme({ hint: '"dark"' })).toBe("dark");
    });

    it("falls back to the theme cookie", () => {
        expect(parseTheme({ cookie: "dark" })).toBe("dark");
        expect(parseTheme({ cookie: "light" })).toBe("light");
    });

    it("defaults to light for an unknown value", () => {
        expect(parseTheme({})).toBe("light");
        expect(parseTheme({ cookie: "sepia", hint: "sepia" })).toBe("light");
    });
});
