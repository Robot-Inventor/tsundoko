import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";
import { type } from "arktype";

const authClient = createAuthClient({
    plugins: [passkeyClient()]
});

const authStatus = type({
    needsSetup: "boolean",
    signupEnabled: "boolean"
});

type AuthStatus = typeof authStatus.infer;

interface AuthState extends AuthStatus {
    signedIn: boolean;
}

let cached: AuthState | null = null;

const loadAuthState = async (): Promise<AuthState> => {
    const response = await fetch("/api/auth/status");

    if (!response.ok) {
        throw new Error("Could not load the authentication state.");
    }

    const status = authStatus(await response.json());

    if (status instanceof type.errors) {
        throw new Error("Could not load the authentication state.");
    }

    const session = await authClient.getSession();

    cached = {
        needsSetup: status.needsSetup,
        signedIn: Boolean(session.data?.session),
        signupEnabled: status.signupEnabled
    };

    return cached;
};

const getAuthState = async (): Promise<AuthState> => cached ?? (await loadAuthState());

const clearAuthState = (): void => {
    cached = null;
};

export { authClient, clearAuthState, getAuthState };
