import { type Account, meClient } from "../lib/meClient";
import { authClient, clearAuthState } from "../lib/authClient";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { notifyError } from "../lib/appToast";
import { useRouter } from "@tanstack/react-router";

interface AccountContextValue {
    account: Account | null;
    // True when the last fetch failed, so the settings page can offer a retry instead of loading forever.
    failed: boolean;
    // Settings calls this after saving so the sidebar avatar and name change without a reload.
    refresh: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

// The /api/me payload is an account on success; failures (including a non-JSON error body)
// collapse to null, and the caller turns null into the failed state.
const loadAccount = async (): Promise<Account | null> => {
    try {
        const response = await meClient.api.me.$get();

        if (response.ok) {
            return await response.json();
        }

        return null;
    } catch {
        return null;
    }
};

const useAccountState = (): AccountContextValue => {
    const [account, setAccount] = useState<Account | null>(null);
    const [failed, setFailed] = useState(false);
    const [reload, setReload] = useState(false);

    useEffect(() => {
        const request = {
            cancelled: false
        };

        void (async (): Promise<void> => {
            const nextAccount = await loadAccount();

            if (request.cancelled) {
                return;
            }

            if (nextAccount) {
                setAccount(nextAccount);
                setFailed(false);
            } else {
                setFailed(true);
            }
        })();

        return (): void => {
            request.cancelled = true;
        };
    }, [reload]);

    // Settings saves through this so the sidebar picks up a new name or avatar without a reload.
    const refresh = useCallback((): void => {
        setReload((value) => !value);
    }, []);

    return {
        account,
        failed,
        refresh
    };
};

// Settings sends the user here when a sensitive change needs a sign-in newer than the editing window.
// Signing out first means the login page accepts the redirect instead of bouncing back to the app.
const useRelogin = (): (() => Promise<void>) => {
    const router = useRouter();

    return useCallback(async (): Promise<void> => {
        try {
            await authClient.signOut();
            clearAuthState();
            // Same reason as login: invalidating would rerun this page's guard and lose the redirect.
            await router.navigate({
                search: {
                    redirect: "/settings"
                },
                to: "/login"
            });
        } catch {
            notifyError("再ログインできませんでした。");
        }
    }, [router]);
};

const useAccountContext = (): AccountContextValue => {
    const value = useContext(AccountContext);

    if (!value) {
        throw new Error("AccountProvider is missing");
    }

    return value;
};

export { AccountContext, type AccountContextValue, useAccountContext, useAccountState, useRelogin };
