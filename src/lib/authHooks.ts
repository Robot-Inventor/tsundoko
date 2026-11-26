import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import { getPasskeyEditingDeadline, isPasskeyEditingAllowed } from "./passkeyPolicy";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { passkey } from "../db/auth-schema";
import { type } from "arktype";

// The registration ceremony is two calls: options (which starts the browser prompt) and verification
// (which stores the passkey). Guarding both means a stale session cannot start a prompt or finish one.
const guardedPaths = new Set(["/passkey/generate-register-options", "/passkey/verify-registration"]);

const signupVerifyBody = type({ createSession: "boolean = false" });

const authenticationResponse = type({
    response: {
        id: "string"
    }
});

const hasSignupContext = (request: Request | undefined): boolean =>
    request ? new URL(request.url).searchParams.has("context") : false;

const isSignupVerify = (body: unknown): boolean => {
    const parsed = signupVerifyBody(body);

    return !(parsed instanceof type.errors) && parsed.createSession;
};

// Settings can add or remove passkeys only while the sign-in is recent. Signup has no session yet, so
// it is recognised by its token and left to the existing validation in auth.ts.
const guardPasskeyChanges = createAuthMiddleware(async (context) => {
    // Deletion runs through /api/passkeys/:id, which checks freshness and keeps the last passkey inside
    // one transaction; the plugin's own endpoint would allow a concurrent check-then-delete race.
    if (context.path === "/passkey/delete-passkey") {
        throw APIError.from("BAD_REQUEST", {
            code: "auth.passkeyDeleteUnavailable",
            message: "auth.passkeyDeleteUnavailable"
        });
    }

    if (!guardedPaths.has(context.path)) {
        return;
    }

    const session = await getSessionFromCtx(context);

    if (!session) {
        const signup =
            context.path === "/passkey/generate-register-options"
                ? hasSignupContext(context.request)
                : isSignupVerify(context.body);

        if (!signup) {
            throw APIError.from("UNAUTHORIZED", {
                code: "passkey.reauthenticate",
                message: "passkey.reauthenticate"
            });
        }

        return;
    }

    if (!isPasskeyEditingAllowed(getPasskeyEditingDeadline(new Date(session.session.createdAt)))) {
        throw APIError.from("FORBIDDEN", {
            code: "passkey.reauthenticate",
            message: "passkey.reauthenticate"
        });
    }
});

const recordPasskeyUsage = createAuthMiddleware(async (context) => {
    // After hooks also run for failed endpoints, so only a successful verification may mark the passkey.
    if (context.path !== "/passkey/verify-authentication" || isAPIError(context.context.returned)) {
        return;
    }

    const parsed = authenticationResponse(context.body);

    if (parsed instanceof type.errors) {
        return;
    }

    // The credential ID is the WebAuthn identifier the browser just used, so it points at the row that
    // was verified without trusting any user-supplied passkey id.
    try {
        await db.update(passkey).set({ lastUsedAt: new Date() }).where(eq(passkey.credentialID, parsed.response.id));
    } catch {
        // The sign-in already succeeded; a bookkeeping failure must not turn it into an error.
    }
});

const authHooks = {
    after: recordPasskeyUsage,
    before: guardPasskeyChanges
} as const;

export { authHooks };
