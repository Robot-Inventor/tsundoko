import { beforeAll, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const noContent = 204;
const token = "payload.signature";

beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-thirty-two-characters";
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/test";

    vi.resetModules();
});

const cookieFor = async (secure: boolean): Promise<string | null> => {
    const { setSignupCookie } = await import("./signupToken");
    const app = new Hono().post("/", (context) => {
        setSignupCookie(context, token, secure);

        return context.body(null, noContent);
    });

    const response = await app.request("/", { method: "POST" });

    return response.headers.get("set-cookie");
};

describe("signup cookie", () => {
    it("keeps the token out of JavaScript and limits its lifetime", async () => {
        const { signupCookieName, signupTokenTtlSeconds } = await import("./signupToken");
        const cookie = await cookieFor(false);

        expect(cookie).toContain(`${signupCookieName}=${token}`);
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain(`Max-Age=${String(signupTokenTtlSeconds)}`);
        expect(cookie).toContain("Path=/");
        expect(cookie).toContain("SameSite=Lax");
        expect(cookie).not.toContain("Secure");
    });

    it("marks the cookie Secure when the public URL uses HTTPS", async () => {
        const cookie = await cookieFor(true);

        expect(cookie).toContain("Secure");
    });
});
