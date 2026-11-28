import { account, passkey as passkeys, session, user, verification } from "../db/auth-schema";
import { createSignupUser, resolveSignupUser, verifySignup } from "./signupUser";
import { authHooks } from "./authHooks";
import { betterAuth } from "better-auth";
import { db } from "../db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "../env";
import { getCurrentAdapter } from "@better-auth/core/context";
import { passkey } from "@better-auth/passkey";
import { signupContextMarker } from "./signupContext";

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
    hooks: authHooks,
    plugins: [
        passkey({
            registration: {
                afterVerification: async (contextData) => {
                    // Only the signup flow carries the marker. A signed-in user adding a passkey from
                    // settings has none, so the plugin's normal registration path must run.
                    if (contextData.context !== signupContextMarker) {
                        return;
                    }

                    const signup = verifySignup(contextData.ctx.body, contextData.ctx.request);
                    const adapter = await getCurrentAdapter(contextData.ctx.context.adapter);

                    return await createSignupUser(adapter, contextData.user.id, signup);
                },
                requireSession: false,
                resolveUser: ({ ctx }) => resolveSignupUser(ctx.request)
            },
            rpName: "Tsundoko"
        })
    ],
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: ["http://localhost:5173"]
});

export { auth };
