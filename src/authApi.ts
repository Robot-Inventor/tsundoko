import { needsSetup, signupAllowed } from "./lib/signupPolicy";
import { Hono } from "hono";
import { auth } from "./lib/auth";
import { createSignupToken } from "./lib/signupToken";
import { env } from "./env";
import { httpStatus } from "./lib/httpStatus";
import { type } from "arktype";

const signupRequest = type({
    email: type("string.trim").to("string.email"),
    name: type("string.trim").to("string >= 1")
});

const authApi = new Hono()
    .get("/api/auth/status", async (context) => {
        context.header("Cache-Control", "no-store");

        return context.json(
            {
                needsSetup: await needsSetup(),
                signupEnabled: env.ENABLE_SIGNUP
            },
            httpStatus.ok
        );
    })
    .post("/api/auth/signup-context", async (context) => {
        context.header("Cache-Control", "no-store");

        const parsed = signupRequest(await context.req.json().catch(() => null));

        if (parsed instanceof type.errors) {
            return context.json({ error: "メールアドレスとユーザー名を入力してください。" }, httpStatus.badRequest);
        }

        if (!(await signupAllowed())) {
            return context.json({ error: "現在は新規サインアップを受け付けていません。" }, httpStatus.forbidden);
        }

        const email = parsed.email.toLowerCase();
        const { name } = parsed;

        // A duplicate address is rejected when the user row is inserted: createSignupUser re-checks
        // emailTaken, and the unique index on user.email catches a concurrent signup. Reporting it
        // here would let an unauthenticated caller enumerate registered addresses through the status.
        return context.json({ token: createSignupToken({ email, name }) }, httpStatus.ok);
    })
    .on(["POST", "GET"], "/api/auth/*", (context) => auth.handler(context.req.raw));

export { authApi };
