import { createSignupToken, setSignupCookie } from "./lib/signupToken";
import { needsSetup, signupAllowed } from "./lib/signupPolicy";
import { Hono } from "hono";
import { apiError } from "./lib/apiError";
import { auth } from "./lib/auth";
import { createRateLimit } from "./lib/rateLimit";
import { env } from "./env";
import { httpStatus } from "./lib/httpStatus";
import { requestBodyLimit } from "./lib/requestBodyLimit";
import { type } from "arktype";

const authRequestLimit = 30;
const forwardedForHeader = "x-forwarded-for";
const unknownClientIp = "unknown";

const signupRequest = type({
    email: type("string.trim").to("string.email"),
    locale: '"ja" | "en"',
    name: type("string.trim").to("string >= 1")
});

// These routes run before authentication, so userId cannot key them. A client can forge the leading
// X-Forwarded-For entries; the last one is the address the deployment proxy actually observed.
const authRateLimit = createRateLimit({
    key: (context) => context.req.header(forwardedForHeader)?.split(",").pop()?.trim() ?? unknownClientIp,
    limit: authRequestLimit
});

const authApi = new Hono()
    .get("/api/auth/status", authRateLimit, async (context) => {
        context.header("Cache-Control", "no-store");

        return context.json(
            {
                needsSetup: await needsSetup(),
                signupEnabled: env.ENABLE_SIGNUP
            },
            httpStatus.ok
        );
    })
    .post("/api/auth/signup-context", authRateLimit, requestBodyLimit("auth.tooLong"), async (context) => {
        context.header("Cache-Control", "no-store");

        const parsed = signupRequest(await context.req.json().catch(() => null));

        if (parsed instanceof type.errors) {
            return context.json(apiError("auth.invalidSignupInput"), httpStatus.badRequest);
        }

        if (!(await signupAllowed())) {
            return context.json(apiError("auth.signupClosed"), httpStatus.forbidden);
        }

        const email = parsed.email.toLowerCase();
        const { name } = parsed;

        // A duplicate address is rejected when the user row is inserted: createSignupUser re-checks
        // emailTaken, and the unique index on user.email catches a concurrent signup. Reporting it
        // here would let an unauthenticated caller enumerate registered addresses through the status.
        setSignupCookie(
            context,
            createSignupToken({ email, locale: parsed.locale, name }),
            new URL(env.BETTER_AUTH_URL).protocol === "https:"
        );

        return context.body(null, httpStatus.noContent);
    })
    .on(["POST", "GET"], "/api/auth/*", requestBodyLimit("auth.tooLong"), (context) => auth.handler(context.req.raw));

export { authApi };
