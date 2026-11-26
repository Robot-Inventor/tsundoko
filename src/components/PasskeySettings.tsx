// oxlint-disable import/max-dependencies -- Settings wires account, passkey, and toast concerns.
import { type PasskeyError, minimumPasskeysForDeletion, toPasskeyError } from "../lib/passkey";
import { type ReactNode, useState } from "react";
import { notifyError, notifySuccess } from "../lib/appToast";
import { useAccountContext, useRelogin } from "../hooks/useAccount";
import { Button } from "./ui/button";
import { PasskeyCard } from "./PasskeyCard";
import { authClient } from "../lib/authClient";
import { authErrorMessage } from "../lib/errorMessage";
import { usePasskeyEditingAllowed } from "../hooks/usePasskeyEditing";
import { usePasskeys } from "../hooks/usePasskeys";
import { useTranslation } from "react-i18next";

const PasskeySettings = (): ReactNode => {
    const { account } = useAccountContext();
    const { error, passkeys, refresh } = usePasskeys();
    const withinWindow = usePasskeyEditingAllowed(account?.passkeyEditableUntil ?? "");
    // Re-login remounts the settings page, so this flag only has to last until then.
    const [sessionStale, setSessionStale] = useState(false);
    const [busy, setBusy] = useState(false);
    const relogin = useRelogin();
    const { t: translate } = useTranslation();

    const addAllowed = withinWindow && !sessionStale;

    const handleError = (failure: PasskeyError): void => {
        if (failure.code === "passkey.reauthenticate") {
            setSessionStale(true);
        }

        notifyError(authErrorMessage(failure, "passkey.saveFailed"));
    };

    const addPasskey = async (): Promise<void> => {
        setBusy(true);

        try {
            const result = await authClient.passkey.addPasskey();

            if (result.error) {
                handleError(toPasskeyError(result.error));
            } else {
                refresh();
                notifySuccess(translate("passkey.added"));
            }
        } catch {
            notifyError(translate("errors.passkey.saveFailed"));
        }

        setBusy(false);
    };

    return (
        <section className="space-y-4">
            <h2 className="text-lg font-semibold">{translate("passkey.title")}</h2>
            {account && !addAllowed ? (
                <div
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/50 p-3"
                    role="status"
                >
                    <p className="text-sm">{translate("passkey.reauthenticate")}</p>
                    <Button
                        onClick={() => {
                            void relogin();
                        }}
                        size="sm"
                        variant="outline"
                    >
                        {translate("passkey.relogin")}
                    </Button>
                </div>
            ) : null}
            {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
            {passkeys && !passkeys.length ? (
                <p className="text-sm text-muted-foreground">{translate("passkey.empty")}</p>
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
                {translate("passkey.add")}
            </Button>
        </section>
    );
};

export { PasskeySettings };
