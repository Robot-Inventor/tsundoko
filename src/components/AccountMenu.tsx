import { AccountContext, type AccountContextValue } from "../hooks/useAccount";
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
import { authClient, clearAuthState } from "../lib/authClient";
import type { Account } from "../lib/meClient";
import { Button } from "./ui/button";
import type { ReactNode } from "react";

const AccountProvider = ({ children, value }: { children: ReactNode; value: AccountContextValue }): ReactNode => (
    <AccountContext value={value}>{children}</AccountContext>
);

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

export { AccountProvider, MobileAccountMenu, SidebarAccountMenu };
