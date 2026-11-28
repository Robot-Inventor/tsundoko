import { Link, useLoaderData, useRouter } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { apiErrorMessage, authErrorMessage } from "../lib/errorMessage";
import { authClient, clearAuthState } from "../lib/authClient";
import { Button } from "./ui/button";
import { Input } from "./ui/Input";
import { hasPendingShare } from "../lib/pendingShare";
import { signupContextMarker } from "../lib/signupContext";
import { useLocale } from "../hooks/useLocale";
import { useTranslation } from "react-i18next";

type SignupContextResult = { kind: "error"; message: string } | { kind: "ready" };

const requestSignupContext = async (email: string, locale: "ja" | "en", name: string): Promise<SignupContextResult> => {
    const response = await fetch("/api/auth/signup-context", {
        body: JSON.stringify({ email, locale, name }),
        headers: {
            "content-type": "application/json"
        },
        method: "POST"
    });

    return response.ok
        ? {
              kind: "ready"
          }
        : {
              kind: "error",
              message: apiErrorMessage(await response.json().catch(() => null), "signup.startFailed")
          };
};

interface SignupFormProps {
    busy: boolean;
    email: string;
    name: string;
    needsSetup: boolean;
    onEmailChange: (value: string) => void;
    onSubmit: (event: { preventDefault: () => void }) => void;
    onNameChange: (value: string) => void;
}

const SignupForm = ({
    busy,
    email,
    name,
    needsSetup,
    onEmailChange,
    onSubmit,
    onNameChange
}: SignupFormProps): ReactNode => {
    const { t: translate } = useTranslation();

    return (
        <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-2">
                <label className="block text-sm font-medium" htmlFor="email">
                    {translate("auth.emailLabel")}
                </label>
                <Input
                    autoComplete="email"
                    id="email"
                    onChange={(event) => {
                        onEmailChange(event.target.value);
                    }}
                    required
                    type="email"
                    value={email}
                />
            </div>
            <div className="space-y-2">
                <label className="block text-sm font-medium" htmlFor="name">
                    {translate("auth.usernameLabel")}
                </label>
                <Input
                    autoComplete="nickname"
                    id="name"
                    onChange={(event) => {
                        onNameChange(event.target.value);
                    }}
                    required
                    value={name}
                />
            </div>
            <Button className="w-full" disabled={busy} type="submit">
                {needsSetup ? translate("auth.createAccount") : translate("auth.registerPasskey")}
            </Button>
        </form>
    );
};

const SignupPage = (): ReactNode => {
    const { needsSetup } = useLoaderData({ from: "/signup" });
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const { locale } = useLocale();
    const { t: translate } = useTranslation();

    const signup = async (): Promise<void> => {
        setBusy(true);
        setError(null);

        try {
            const context = await requestSignupContext(email, locale, name);

            if (context.kind === "error") {
                setError(context.message);
            } else {
                const result = await authClient.passkey.addPasskey({
                    context: signupContextMarker,
                    createSession: true
                });

                if (result.error) {
                    setError(authErrorMessage(result.error, "auth.signupFailed"));
                } else {
                    clearAuthState();
                    await router.navigate({
                        to: hasPendingShare() ? "/share" : "/"
                    });
                }
            }
        } catch {
            setError(translate("auth.signupFailed"));
        }

        setBusy(false);
    };

    const handleSubmit = (event: { preventDefault: () => void }): void => {
        event.preventDefault();
        void signup();
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-xl font-semibold">
                    {needsSetup ? translate("auth.setupTitle") : translate("auth.signupTitle")}
                </h1>
                <p className="text-muted-foreground">{translate("auth.signupDescription")}</p>
            </div>
            <SignupForm
                busy={busy}
                email={email}
                name={name}
                needsSetup={needsSetup}
                onEmailChange={setEmail}
                onSubmit={handleSubmit}
                onNameChange={setName}
            />
            {needsSetup ? null : (
                <p className="text-center text-sm text-muted-foreground">
                    <Link className="underline" to="/login">
                        {translate("auth.backToLogin")}
                    </Link>
                </p>
            )}
            {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
};

export { SignupPage };
