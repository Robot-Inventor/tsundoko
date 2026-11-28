import { beforeAll, describe, expect, it, vi } from "vitest";

const firstIndex = 0;
const oneCharacter = 1;
const oneMinuteMs = 60_000;
const threeMinutesMs = 180_000;
const sixMinutesMs = 360_000;
const testSecret = "test-secret-at-least-thirty-two-characters";

beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = testSecret;
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/test";

    vi.resetModules();
});

describe("signup context token", () => {
    it("rejects a tampered token", async () => {
        const { createSignupToken, readSignupToken } = await import("./signupToken");
        const token = createSignupToken({
            email: "a@example.com",
            locale: "en",
            name: "A"
        });

        const [payload, signature] = token.split(".");

        if (!payload || !signature) {
            throw new Error("トークンの形式が不正です。");
        }

        const first = signature.slice(firstIndex, oneCharacter);
        const tampered = `${payload}.${first === "a" ? "b" : "a"}${signature.slice(oneCharacter)}`;

        expect(readSignupToken(tampered)).toBeNull();
    });

    it("rejects an expired token", async () => {
        const { createSignupToken, readSignupToken } = await import("./signupToken");
        const token = createSignupToken({
            email: "a@example.com",
            locale: "en",
            name: "A"
        });

        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + sixMinutesMs);

        expect(readSignupToken(token)).toBeNull();

        vi.useRealTimers();
    });

    it("accepts a valid token", async () => {
        const { createSignupToken, readSignupToken } = await import("./signupToken");
        const token = createSignupToken({
            email: "a@example.com",
            locale: "en",
            name: "A"
        });

        expect(readSignupToken(token)).toStrictEqual({
            email: "a@example.com",
            locale: "en",
            name: "A"
        });
    });

    it("expires within three minutes", async () => {
        const { createSignupToken, readSignupToken } = await import("./signupToken");
        const token = createSignupToken({
            email: "a@example.com",
            locale: "en",
            name: "A"
        });

        const now = Date.now();

        vi.useFakeTimers();
        vi.setSystemTime(now + oneMinuteMs);

        expect(readSignupToken(token)).not.toBeNull();

        vi.setSystemTime(now + threeMinutesMs);

        expect(readSignupToken(token)).toBeNull();

        vi.useRealTimers();
    });
});

describe("signup context cookie", () => {
    it("reads the token from the cookie and never from the query string", async () => {
        const { createSignupToken, readSignupTokenFromRequest, signupCookieName } = await import("./signupToken");
        const token = createSignupToken({
            email: "a@example.com",
            locale: "en",
            name: "A"
        });

        const signup = {
            email: "a@example.com",
            locale: "en",
            name: "A"
        } as const;

        const requestWithCookie = (name: string): Request =>
            new Request("https://example.com", {
                headers: {
                    cookie: `${name}=${token}`
                }
            });

        expect(readSignupTokenFromRequest(requestWithCookie(signupCookieName))).toStrictEqual(signup);

        expect(readSignupTokenFromRequest(new Request("https://example.com"))).toBeNull();

        expect(readSignupTokenFromRequest(new Request(`https://example.com?context=${token}`))).toBeNull();

        expect(readSignupTokenFromRequest(requestWithCookie("other"))).toBeNull();
    });
});
