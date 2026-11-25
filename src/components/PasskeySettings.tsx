import { type PasskeyError, minimumPasskeysForDeletion, passkeyMessages, toPasskeyError } from "../lib/passkey";
import { type ReactNode, useState } from "react";
import { notifyError, notifySuccess } from "../lib/appToast";
import { useAccountContext, useRelogin } from "../hooks/useAccount";
import { Button } from "./ui/button";
import { PasskeyCard } from "./PasskeyCard";
import { authClient } from "../lib/authClient";
import { usePasskeyEditingAllowed } from "../hooks/usePasskeyEditing";
import { usePasskeys } from "../hooks/usePasskeys";

const PasskeySettings = (): ReactNode => {
    const { account } = useAccountContext();
    const { error, passkeys, refresh } = usePasskeys();
    const withinWindow = usePasskeyEditingAllowed(account?.passkeyEditableUntil ?? "");
    // Re-login remounts the settings page, so this flag only has to last until then.
    const [sessionStale, setSessionStale] = useState(false);
    const [busy, setBusy] = useState(false);
    const relogin = useRelogin();

    const addAllowed = withinWindow && !sessionStale;

    const handleError = (failure: PasskeyError): void => {
        if (failure.code === "SESSION_NOT_FRESH") {
            setSessionStale(true);
        }

        notifyError(failure.message);
    };

    const addPasskey = async (): Promise<void> => {
        setBusy(true);

        try {
            const result = await authClient.passkey.addPasskey();

            if (result.error) {
                handleError(toPasskeyError(result.error));
            } else {
                refresh();
                notifySuccess("パスキーを追加しました");
            }
        } catch {
            notifyError(passkeyMessages.saveFailed);
        }

        setBusy(false);
    };

    return (
        <section className="space-y-4">
            <h2 className="text-lg font-semibold">パスキー</h2>
            {account && !addAllowed ? (
                <div
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/50 p-3"
                    role="status"
                >
                    <p className="text-sm">{passkeyMessages.reauthenticate}</p>
                    <Button
                        onClick={() => {
                            void relogin();
                        }}
                        size="sm"
                        variant="outline"
                    >
                        再ログイン
                    </Button>
                </div>
            ) : null}
            {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
            {passkeys && !passkeys.length ? (
                <p className="text-sm text-muted-foreground">パスキーがありません。</p>
            ) : null}
            <ul className="divide-y">
                {passkeys?.map((passkey) => (
                    <li key={passkey.id}>
                        <PasskeyCard
                            canDelete={passkeys.length >= minimumPasskeysForDeletion}
                            deleteAllowed={addAllowed}
                            onChanged={refresh}
                            onError={handleError}
                            passkey={passkey}
                        />
                    </li>
                ))}
            </ul>
            <Button
                disabled={busy || !addAllowed}
                onClick={() => {
                    void addPasskey();
                }}
                variant="outline"
            >
                パスキーを追加
            </Button>
        </section>
    );
};

export { PasskeySettings };
