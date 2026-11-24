import { type SignupInfo, readSignupToken } from "./signupToken";
import { emailTaken, signupAllowed } from "./signupPolicy";
import { APIError } from "better-auth/api";
import type { DBTransactionAdapter } from "@better-auth/core/db/adapter";
import { env } from "../env";
import { type } from "arktype";

const invalidSignupMessage = "サインアップの有効期限が切れました。もう一度お試しください。";
const setupGuardIdentifier = "initial-signup-guard";
const uniqueViolationCode = "23505";
const registrationBody = type({ createSession: "boolean" });

const guardExpiresAt = new Date("9999-12-31T00:00:00.000Z");

const isUniqueViolation = (error: unknown): boolean =>
    typeof error === "object" && error !== null && "code" in error && error.code === uniqueViolationCode;

const resolveSignupUser = (context: string | null | undefined): { displayName: string; id: string; name: string } => {
    const signup = context ? readSignupToken(context) : null;

    if (!signup) {
        throw new APIError("BAD_REQUEST", {
            message: invalidSignupMessage
        });
    }

    return {
        displayName: signup.name,
        id: crypto.randomUUID(),
        name: signup.email
    };
};

const verifySignup = (body: unknown, context: string | null | undefined): SignupInfo => {
    // The plugin only opens a transaction when a session is created. Signup must use that path.
    const parsed = registrationBody(body);

    if (parsed instanceof type.errors || !parsed.createSession) {
        throw new APIError("BAD_REQUEST", {
            message: "パスキー登録を完了できませんでした。"
        });
    }

    const signup = context ? readSignupToken(context) : null;

    if (!signup) {
        throw new APIError("BAD_REQUEST", {
            message: invalidSignupMessage
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
            message: "現在は新規サインアップを受け付けていません。"
        });
    }

    if (await emailTaken(signup.email)) {
        throw new APIError("CONFLICT", {
            message: "このメールアドレスはすでに登録されています。"
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
                    message: "現在は新規サインアップを受け付けていません。"
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
                name: signup.name,
                updatedAt: new Date()
            },
            forceAllowId: true,
            model: "user"
        });
    } catch (error) {
        if (isUniqueViolation(error)) {
            throw new APIError("CONFLICT", {
                message: "このメールアドレスはすでに登録されています。"
            });
        }

        throw error;
    }

    return {
        userId
    };
};

export { createSignupUser, resolveSignupUser, verifySignup };
