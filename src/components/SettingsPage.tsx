import { AccountSettings } from "./AccountSettings";
import { Button } from "./ui/button";
import { PasskeySettings } from "./PasskeySettings";
import type { ReactNode } from "react";
import { pages } from "../lib/page-title";
import { useAccountContext } from "../hooks/useAccount";

const SettingsContent = (): ReactNode => {
    const { account, failed, refresh } = useAccountContext();

    if (failed) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-destructive" role="alert">
                    アカウント情報を読み込めませんでした。
                </p>
                <Button onClick={refresh} variant="outline">
                    再読み込み
                </Button>
            </div>
        );
    }

    if (!account) {
        return <p className="text-muted-foreground">読み込み中です。</p>;
    }

    return (
        <>
            <AccountSettings />
            <PasskeySettings />
        </>
    );
};

const SettingsPage = (): ReactNode => (
    <>
        {/* The mobile header carries the page title, so the in-page h1 shows on desktop only. */}
        <h1 className="hidden text-xl font-semibold md:block">{pages["/settings"].label}</h1>
        <div className="mt-4 max-w-2xl space-y-10">
            <SettingsContent />
        </div>
    </>
);

export { SettingsPage };
