import { Link, useLoaderData, useRouter, useSearch } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { authClient, clearAuthState } from "../lib/authClient";
import { Button } from "./ui/button";
import { authErrorMessage } from "../lib/errorMessage";
import { useTranslation } from "react-i18next";

const LoginPage = (): ReactNode => {
    const { needsSetup, signupEnabled } = useLoaderData({ from: "/login" });
    const { redirect } = useSearch({ from: "/login" });
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const { t: translate } = useTranslation();

    const login = async (): Promise<void> => {
        setBusy(true);
        setError(null);

        try {
            const result = await authClient.signIn.passkey();

            if (result.error) {
                setError(authErrorMessage(result.error, "auth.loginFailed"));
            } else {
                clearAuthState();
                // Navigating first lets the target route's guard read the fresh session; invalidating here
                // would run the login route's guest guard and drop the redirect before it is used.
                await router.navigate({
                    to: redirect ?? "/"
                });
            }
        } catch {
            setError(translate("auth.loginFailed"));
        }

        setBusy(false);
    };

    const handleLogin = (): void => {
        void login();
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-xl font-semibold">{translate("auth.loginTitle")}</h1>
                <p className="text-muted-foreground">{translate("auth.loginDescription")}</p>
            </div>
            <Button className="w-full" disabled={busy} onClick={handleLogin}>
                {translate("auth.loginButton")}
            </Button>
            {needsSetup || signupEnabled ? (
                <p className="text-center text-sm text-muted-foreground">
                    {translate("auth.noAccount")}{" "}
                    <Link className="underline" to="/signup">
                        {translate("auth.signupLink")}
                    </Link>
                </p>
            ) : null}
            {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
};

export { LoginPage };
