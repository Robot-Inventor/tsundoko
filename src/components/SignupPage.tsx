import { Link, useLoaderData, useRouter } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { authClient, clearAuthState } from "../lib/authClient";
import { Button } from "./ui/button";
import { Input } from "./ui/Input";
import { hasPendingShare } from "../lib/pendingShare";
import { type } from "arktype";

const errorResponse = type({ error: "string" });
const tokenResponse = type({ token: "string" });

type SignupTokenResult = { kind: "error"; message: string } | { kind: "token"; token: string };

const requestSignupToken = async (email: string, name: string): Promise<SignupTokenResult> => {
    const response = await fetch("/api/auth/signup-context", {
        body: JSON.stringify({ email, name }),
        headers: {
            "content-type": "application/json"
        },
        method: "POST"
    });

    if (!response.ok) {
        const failure = errorResponse(await response.json());

        return {
            kind: "error",
            message: failure instanceof type.errors ? "サインアップを開始できませんでした。" : failure.error
        };
    }

    const token = tokenResponse(await response.json());

    return token instanceof type.errors
        ? {
              kind: "error",
              message: "サインアップを開始できませんでした。"
          }
        : {
              kind: "token",
              token: token.token
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
}: SignupFormProps): ReactNode => (
    <form className="space-y-6" onSubmit={onSubmit}>
        <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="email">
                メールアドレス
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
                ユーザー名
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
            {needsSetup ? "アカウントを作成" : "登録してパスキーを作成"}
        </Button>
    </form>
);

const SignupPage = (): ReactNode => {
    const { needsSetup } = useLoaderData({ from: "/signup" });
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const signup = async (): Promise<void> => {
        setBusy(true);
        setError(null);

        try {
            const token = await requestSignupToken(email, name);

            if (token.kind === "error") {
                setError(token.message);
            } else {
                const result = await authClient.passkey.addPasskey({
                    context: token.token,
                    createSession: true
                });

                if (result.error) {
                    setError(result.error.message ?? "アカウントを作成できませんでした。");
                } else {
                    clearAuthState();
                    await router.navigate({
                        to: hasPendingShare() ? "/share" : "/"
                    });
                }
            }
        } catch {
            setError("アカウントを作成できませんでした。");
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
                <h1 className="text-xl font-semibold">{needsSetup ? "最初のアカウントを作成" : "新規登録"}</h1>
                <p className="text-muted-foreground">メールアドレスとユーザー名を入力し、パスキーを登録します。</p>
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
                        ログインに戻る
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
