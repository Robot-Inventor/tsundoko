import { AccountSettings } from "./AccountSettings";
import { Button } from "./ui/button";
import { PasskeySettings } from "./PasskeySettings";
import type { ReactNode } from "react";
import { useAccountContext } from "../hooks/useAccount";
import { useTranslation } from "react-i18next";

const SettingsContent = (): ReactNode => {
    const { account, failed, refresh } = useAccountContext();
    const { t: translate } = useTranslation();

    if (failed) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-destructive" role="alert">
                    {translate("settings.loadFailed")}
                </p>
                <Button onClick={refresh} variant="outline">
                    {translate("common.retry")}
                </Button>
            </div>
        );
    }

    if (!account) {
        return <p className="text-muted-foreground">{translate("common.loading")}</p>;
    }

    return (
        <>
            <AccountSettings />
            <PasskeySettings />
        </>
    );
};

const SettingsPage = (): ReactNode => {
    const { t: translate } = useTranslation();

    return (
        <>
            {/* The mobile header carries the page title, so the in-page h1 shows on desktop only. */}
            <h1 className="hidden text-xl font-semibold md:block">{translate("page.settings")}</h1>
            <div className="mt-4 max-w-2xl space-y-10">
                <SettingsContent />
            </div>
        </>
    );
};

export { SettingsPage };
