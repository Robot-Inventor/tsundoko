import { type Account, meClient } from "../lib/meClient";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "./ui/dropdown-menu";
import { EllipsisVerticalIcon, LogOutIcon, SettingsIcon } from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import { authClient, clearAuthState } from "../lib/authClient";
import { Button } from "./ui/button";
import { notifyError } from "../lib/appToast";

interface AccountContextValue {
    account: Account | null;
    // True when the last fetch failed, so the settings page can offer a retry instead of loading forever.
    failed: boolean;
    // Settings calls this after saving so the sidebar avatar and name change without a reload.
    refresh: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const useAccountState = (): AccountContextValue => {
    const [account, setAccount] = useState<Account | null>(null);
    const [failed, setFailed] = useState(false);
    const [reload, setReload] = useState(false);

    useEffect(() => {
        const request = {
            cancelled: false
        };

        void (async (): Promise<void> => {
            try {
                const response = await meClient.api.me.$get();

                if (request.cancelled) {
                    return;
                }

                if (response.ok) {
                    setAccount(await response.json());
                    setFailed(false);
                } else {
                    setFailed(true);
                }
            } catch {
                if (!request.cancelled) {
                    // The sidebar row is optional chrome, but settings needs to know it failed.
                    setFailed(true);
                }
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

const AccountProvider = ({ children, value }: { children: ReactNode; value: AccountContextValue }): ReactNode => (
    <AccountContext value={value}>{children}</AccountContext>
);

const useAccountContext = (): AccountContextValue => {
    const value = useContext(AccountContext);

    if (!value) {
        throw new Error("AccountProvider is missing");
    }

    return value;
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

const AccountAvatar = ({ account }: { account: Account }): ReactNode => (
    <Avatar>
        {/* The name sits beside the avatar, so the image itself carries no text alternative. */}
        <AvatarImage alt="" referrerPolicy="no-referrer" src={account.avatarUrl} />
        <AvatarFallback aria-hidden="true">{Array.from(account.name)[0] ?? ""}</AvatarFallback>
    </Avatar>
);

const AccountNames = ({ account }: { account: Account }): ReactNode => (
    <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" title={account.name}>
            {account.name}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={account.email}>
            {account.email}
        </p>
    </div>
);

const AccountMenuItems = ({ onNavigate }: { onNavigate?: () => void }): ReactNode => {
    const router = useRouter();

    const logout = async (): Promise<void> => {
        await authClient.signOut();
        clearAuthState();
        await router.invalidate();
        await router.navigate({ to: "/login" });
    };

    return (
        <>
            <DropdownMenuItem onClick={onNavigate} render=<Link to="/settings" />>
                <SettingsIcon aria-hidden="true" />
                設定
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
                onClick={() => {
                    onNavigate?.();
                    void logout();
                }}
                variant="destructive"
            >
                <LogOutIcon aria-hidden="true" />
                ログアウト
            </DropdownMenuItem>
        </>
    );
};

const SidebarAccountMenu = ({ account }: { account: Account }): ReactNode => (
    <DropdownMenu>
        <div className="flex items-center gap-2">
            <AccountAvatar account={account} />
            <AccountNames account={account} />
            <DropdownMenuTrigger
                aria-label={`${account.name}のアカウントメニューを開く`}
                render=<Button className="size-11" size="icon" variant="ghost" />
            >
                <EllipsisVerticalIcon aria-hidden="true" />
            </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent align="end" className="w-52" side="top">
            <AccountMenuItems />
        </DropdownMenuContent>
    </DropdownMenu>
);

const MobileAccountMenu = ({ account, onNavigate }: { account: Account; onNavigate: () => void }): ReactNode => (
    <DropdownMenu>
        <DropdownMenuTrigger
            aria-label={`${account.name}のアカウントメニューを開く`}
            render=<Button className="size-11 rounded-full" size="icon" variant="ghost" />
        >
            <AccountAvatar account={account} />
        </DropdownMenuTrigger>
        {/* The icon-only trigger needs the names inside the menu; the sidebar keeps them visible instead.
            The group label is what screen readers announce as the account on entering the menu. */}
        <DropdownMenuContent align="end" className="w-64" sideOffset={8}>
            <DropdownMenuGroup>
                <DropdownMenuLabel className="p-2 text-foreground">
                    <AccountNames account={account} />
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <AccountMenuItems onNavigate={onNavigate} />
            </DropdownMenuGroup>
        </DropdownMenuContent>
    </DropdownMenu>
);

export { AccountProvider, MobileAccountMenu, SidebarAccountMenu, useAccountContext, useAccountState, useRelogin };
