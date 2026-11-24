import { Link, useLoaderData, useRouter, useSearch } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { authClient, clearAuthState } from "../lib/authClient";
import { Button } from "./ui/button";

const LoginPage = (): ReactNode => {
    const { needsSetup, signupEnabled } = useLoaderData({ from: "/login" });
    const { redirect } = useSearch({ from: "/login" });
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const login = async (): Promise<void> => {
        setBusy(true);
        setError(null);

        const result = await authClient.signIn.passkey();

        if (result.error) {
            setError(result.error.message ?? "ログインできませんでした。");
            setBusy(false);

            return;
        }

        clearAuthState();
        // Navigating first lets the target route's guard read the fresh session; invalidating here
        // would run the login route's guest guard and drop the redirect before it is used.
        await router.navigate({
            to: redirect ?? "/"
        });

        setBusy(false);
    };

    const handleLogin = (): void => {
        login().catch(() => {
            setError("ログインできませんでした。");
            setBusy(false);
        });
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-xl font-semibold">ログイン</h1>
                <p className="text-muted-foreground">パスキーでログインします。</p>
            </div>
            <Button className="w-full" disabled={busy} onClick={handleLogin}>
                ログイン
            </Button>
            {needsSetup || signupEnabled ? (
                <p className="text-center text-sm text-muted-foreground">
                    アカウントをお持ちでない場合は{" "}
                    <Link className="underline" to="/signup">
                        新規登録
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
