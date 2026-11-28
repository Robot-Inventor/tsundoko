import { signupCookieName, signupTokenTtlSeconds } from "./signupToken";
import type { Context } from "hono";
import { setCookie } from "hono/cookie";

// The signed token is a bearer credential, so it stays in an HttpOnly cookie instead of the
// passkey plugin's query-string `context`.
const setSignupCookie = (context: Context, token: string, secure: boolean): void => {
    setCookie(context, signupCookieName, token, {
        httpOnly: true,
        maxAge: signupTokenTtlSeconds,
        path: "/",
        sameSite: "Lax",
        secure
    });
};

export { setSignupCookie };
