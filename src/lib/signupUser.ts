import { type SignupInfo, readSignupTokenFromRequest } from "./signupToken";
import { emailTaken, signupAllowed } from "./signupPolicy";
import { APIError } from "better-auth/api";
import type { DBTransactionAdapter } from "@better-auth/core/db/adapter";
import { env } from "../env";
import { type } from "arktype";

const invalidSignupCode = "auth.signupExpired";
const setupGuardIdentifier = "initial-signup-guard";
const uniqueViolationCode = "23505";
const registrationBody = type({ createSession: "boolean" });

const guardExpiresAt = new Date("9999-12-31T00:00:00.000Z");

const isUniqueViolation = (error: unknown): boolean =>
    typeof error === "object" && error !== null && "code" in error && error.code === uniqueViolationCode;

const resolveSignupUser = (request: Request | undefined): { displayName: string; id: string; name: string } => {
    const signup = readSignupTokenFromRequest(request);

    if (!signup) {
        throw new APIError("BAD_REQUEST", {
            code: invalidSignupCode,
            message: invalidSignupCode
        });
    }

    return {
        displayName: signup.name,
        id: crypto.randomUUID(),
        name: signup.email
    };
};

const verifySignup = (body: unknown, request: Request | undefined): SignupInfo => {
    // The plugin only opens a transaction when a session is created. Signup must use that path.
    const parsed = registrationBody(body);

    if (parsed instanceof type.errors || !parsed.createSession) {
        throw new APIError("BAD_REQUEST", {
            code: "auth.passkeyRegistrationFailed",
            message: "auth.passkeyRegistrationFailed"
        });
    }

    const signup = readSignupTokenFromRequest(request);

    if (!signup) {
        throw new APIError("BAD_REQUEST", {
            code: invalidSignupCode,
            message: invalidSignupCode
        });
    }

    return signup;
};

const createSignupUser = async (
    adapter: DBTransactionAdapter,
    userId: string,
    signup: SignupInfo
): Promise<{ userId: string }> => {
    if (!(await signupAllowed())) {
        throw new APIError("FORBIDDEN", {
            code: "auth.signupClosed",
            message: "auth.signupClosed"
        });
    }

    if (await emailTaken(signup.email)) {
        throw new APIError("CONFLICT", {
            code: "auth.emailTaken",
            message: "auth.emailTaken"
        });
    }

    // A singleton row with a unique index gives first-writer-wins when signups are closed.
    // Inserting it in this transaction rolls the claim back if a later write fails.
    if (!env.ENABLE_SIGNUP) {
        try {
            await adapter.create({
                data: {
                    createdAt: new Date(),
                    expiresAt: guardExpiresAt,
                    identifier: setupGuardIdentifier,
                    updatedAt: new Date(),
                    value: userId
                },
                model: "verification"
            });
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new APIError("FORBIDDEN", {
                    code: "auth.signupClosed",
                    message: "auth.signupClosed"
                });
            }

            throw error;
        }
    }

    try {
        await adapter.create({
            data: {
                createdAt: new Date(),
                email: signup.email,
                emailVerified: false,
                id: userId,
                locale: signup.locale,
                name: signup.name,
                updatedAt: new Date()
            },
            forceAllowId: true,
            model: "user"
        });
    } catch (error) {
        if (isUniqueViolation(error)) {
            throw new APIError("CONFLICT", {
                code: "auth.emailTaken",
                message: "auth.emailTaken"
            });
        }

        throw error;
    }

    return {
        userId
    };
};

export { createSignupUser, resolveSignupUser, verifySignup };
