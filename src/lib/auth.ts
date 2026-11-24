import { account, passkey as passkeys, session, user, verification } from "../db/auth-schema";
import { createSignupUser, resolveSignupUser, verifySignup } from "./signupUser";
import { betterAuth } from "better-auth";
import { db } from "../db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "../env";
import { getCurrentAdapter } from "@better-auth/core/context";
import { passkey } from "@better-auth/passkey";

const auth = betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            account,
            passkey: passkeys,
            session,
            user,
            verification
        },
        transaction: true
    }),
    emailAndPassword: {
        enabled: false
    },
    plugins: [
        passkey({
            registration: {
                afterVerification: async (contextData) => {
                    const signup = verifySignup(contextData.ctx.body, contextData.context);
                    const adapter = await getCurrentAdapter(contextData.ctx.context.adapter);

                    return await createSignupUser(adapter, contextData.user.id, signup);
                },
                requireSession: false,
                resolveUser: ({ context }) => resolveSignupUser(context)
            },
            rpName: "Tsundoko"
        })
    ],
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: ["http://localhost:5173"]
});

export { auth };
