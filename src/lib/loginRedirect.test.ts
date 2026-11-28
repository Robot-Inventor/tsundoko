import { describe, expect, it } from "vitest";
import { isLoginRedirect } from "./loginRedirect";

describe("isLoginRedirect", () => {
    it.each(["/", "/?q=cats", "/archive", "/settings", "/share", "/tags/news?q=cat"])(
        "accepts an in-app URL %s",
        (value) => {
            expect(isLoginRedirect(value)).toBe(true);
        }
    );

    it.each(["https://evil.example/", "//evil.example/", "/\\evil.example/", "/login", "/unknown"])(
        "rejects an out-of-app URL %s",
        (value) => {
            expect(isLoginRedirect(value)).toBe(false);
        }
    );
});
