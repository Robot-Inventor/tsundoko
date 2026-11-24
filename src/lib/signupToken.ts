import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";
import { type } from "arktype";

const tokenTtlMinutes = 5;
const millisecondsPerMinute = 60_000;
const tokenTtlMs = tokenTtlMinutes * millisecondsPerMinute;

const tokenPayload = type({
    email: "string >= 1",
    expiresAt: "number",
    name: "string >= 1"
});

interface SignupInfo {
    email: string;
    name: string;
}

const sign = (payload: string): string =>
    createHmac("sha256", env.BETTER_AUTH_SECRET).update(payload).digest("base64url");

const createSignupToken = ({ email, name }: SignupInfo): string => {
    const payload = Buffer.from(
        JSON.stringify({
            email,
            expiresAt: Date.now() + tokenTtlMs,
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
        name: parsed.name
    };
};

export { createSignupToken, readSignupToken, type SignupInfo };
