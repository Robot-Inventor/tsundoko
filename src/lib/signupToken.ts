import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";
import { parse as parseCookie } from "hono/utils/cookie";
import { type } from "arktype";

const signupCookieName = "signup-context";
const tokenTtlMinutes = 2;
const secondsPerMinute = 60;
const millisecondsPerSecond = 1000;
const signupTokenTtlSeconds = tokenTtlMinutes * secondsPerMinute;
const tokenTtlMs = signupTokenTtlSeconds * millisecondsPerSecond;

const tokenPayload = type({
    email: "string >= 1",
    expiresAt: "number",
    locale: '"ja" | "en"',
    name: "string >= 1"
});

interface SignupInfo {
    email: string;
    locale: "ja" | "en";
    name: string;
}

const sign = (payload: string): string =>
    createHmac("sha256", env.BETTER_AUTH_SECRET).update(payload).digest("base64url");

const createSignupToken = ({ email, locale, name }: SignupInfo): string => {
    const payload = Buffer.from(
        JSON.stringify({
            email,
            expiresAt: Date.now() + tokenTtlMs,
            locale,
            name
        })
    ).toString("base64url");

    return `${payload}.${sign(payload)}`;
};

const decodePayload = (payload: string): unknown => {
    try {
        return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
        return null;
    }
};

const readSignupToken = (token: string): SignupInfo | null => {
    const [payload, signature] = token.split(".");

    if (!payload || !signature) {
        return null;
    }

    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        return null;
    }

    const parsed = tokenPayload(decodePayload(payload));

    if (parsed instanceof type.errors || parsed.expiresAt <= Date.now()) {
        return null;
    }

    return {
        email: parsed.email,
        locale: parsed.locale,
        name: parsed.name
    };
};

const readSignupTokenFromRequest = (request: Request | undefined): SignupInfo | null => {
    const cookie = request?.headers.get("cookie") ?? "";
    const token = parseCookie(cookie, signupCookieName)[signupCookieName];

    return token ? readSignupToken(token) : null;
};

export {
    createSignupToken,
    readSignupToken,
    readSignupTokenFromRequest,
    signupCookieName,
    signupTokenTtlSeconds,
    type SignupInfo
};
