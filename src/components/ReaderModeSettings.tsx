import { type ReactNode, useState } from "react";
import { Checkbox } from "./ui/checkbox";
import { errorMessage } from "../lib/errorMessage";
import { meClient } from "../lib/meClient";
import { notifyError } from "../lib/appToast";
import { useAccountContext } from "../hooks/useAccount";
import { useTranslation } from "react-i18next";

const ReaderModeSettings = (): ReactNode => {
    const { account, refresh } = useAccountContext();
    const { t: translate } = useTranslation();
    // The local value keeps the checkbox responsive while the account reload is in flight.
    const [pending, setPending] = useState<boolean | null>(null);
    const checked = pending ?? account?.readerMode ?? false;

    const change = (next: boolean): void => {
        if (!account || next === checked) {
            return;
        }

        setPending(next);
        meClient.api.me
            .$patch({
                json: {
                    readerMode: next
                }
            })
            .then((response) => {
                if (response.ok) {
                    refresh();
                } else {
                    setPending(null);
                    notifyError(errorMessage("auth.readerModeSaveFailed"));
                }
            })
            .catch(() => {
                setPending(null);
                notifyError(errorMessage("auth.readerModeSaveFailed"));
            });
    };

    return (
        <label className="flex cursor-pointer items-start gap-2 text-sm">
            <Checkbox checked={checked} onCheckedChange={change} />
            <span>
                <span className="block font-medium">{translate("settings.readerModeLabel")}</span>
                <span className="block text-muted-foreground">{translate("settings.readerModeDescription")}</span>
            </span>
        </label>
    );
};

export { ReaderModeSettings };
