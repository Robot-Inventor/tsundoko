import { useCallback, useEffect, useState } from "react";
import type { PasskeySummary } from "../lib/passkey";
import { errorMessage } from "../lib/errorMessage";
import { meClient } from "../lib/meClient";
import { type } from "arktype";

const passkeyList = type({
    createdAt: "string | null",
    id: "string",
    lastUsedAt: "string | null",
    name: "string"
}).array();

interface UsePasskeysResult {
    error: string | null;
    passkeys: PasskeySummary[] | null;
    refresh: () => void;
}

const usePasskeys = (): UsePasskeysResult => {
    const [passkeys, setPasskeys] = useState<PasskeySummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reload, setReload] = useState(false);

    useEffect(() => {
        const request = {
            cancelled: false
        };

        void (async (): Promise<void> => {
            try {
                const response = await meClient.api.passkeys.$get();
                const parsed = passkeyList(await response.json());

                if (request.cancelled) {
                    return;
                }

                if (parsed instanceof type.errors) {
                    setError(errorMessage("passkey.loadFailed"));
                } else {
                    setPasskeys(parsed);
                    setError(null);
                }
            } catch {
                if (!request.cancelled) {
                    setError(errorMessage("passkey.loadFailed"));
                }
            }
        })();

        return (): void => {
            request.cancelled = true;
        };
    }, [reload]);

    // Adding or deleting changes the list; flipping the flag re-runs the only fetch path.
    const refresh = useCallback((): void => {
        setReload((value) => !value);
    }, []);

    return {
        error,
        passkeys,
        refresh
    };
};

export { usePasskeys };
