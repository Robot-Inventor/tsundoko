// oxlint-disable import/max-dependencies -- Account settings cover avatar, name, and language.
import { type Account, meClient } from "../lib/meClient";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { type ReactNode, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { apiErrorMessage, errorMessage } from "../lib/errorMessage";
import { notifyError, notifySuccess } from "../lib/appToast";
import { Button } from "./ui/button";
import { Input } from "./ui/Input";
import { authClient } from "../lib/authClient";
import { isLocale } from "../lib/locale";
import { useAccountContext } from "../hooks/useAccount";
import { useLocale } from "../hooks/useLocale";
import { useTranslation } from "react-i18next";

const avatarAccept = "image/png,image/jpeg,image/webp";

const sendAvatar = async (request: RequestInit): Promise<string | null> => {
    const response = await fetch("/api/me/avatar", request);

    if (!response.ok) {
        return apiErrorMessage(await response.json().catch(() => null), "avatar.changeFailed");
    }

    return null;
};

interface AvatarFormProps {
    account: Account;
    onSaved: () => void;
}

interface AccountFormProps {
    account: Account;
    onSaved: () => void;
}

const AvatarForm = ({ account, onSaved }: AvatarFormProps): ReactNode => {
    const fileInput = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t: translate } = useTranslation();

    const run = async (request: RequestInit): Promise<void> => {
        setBusy(true);
        setError(null);

        try {
            const failure = await sendAvatar(request);

            if (failure) {
                setError(failure);
            } else {
                onSaved();
                notifySuccess(translate("settings.avatarChanged"));
            }
        } catch {
            setError(errorMessage("avatar.changeFailed"));
        }

        setBusy(false);
    };

    const hasCustomAvatar = account.avatarUrl.startsWith("data:");

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-4">
                <Avatar size="lg">
                    <AvatarImage alt="" referrerPolicy="no-referrer" src={account.avatarUrl} />
                    <AvatarFallback aria-hidden="true">{Array.from(account.name)[0] ?? ""}</AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap gap-2">
                    <Button
                        disabled={busy}
                        onClick={() => {
                            fileInput.current?.click();
                        }}
                        size="sm"
                        variant="outline"
                    >
                        {translate("settings.changeAvatar")}
                    </Button>
                    {hasCustomAvatar ? (
                        <Button
                            disabled={busy}
                            onClick={() => {
                                void run({
                                    method: "DELETE"
                                });
                            }}
                            size="sm"
                            variant="ghost"
                        >
                            {translate("settings.useGravatar")}
                        </Button>
                    ) : null}
                </div>
                <input
                    accept={avatarAccept}
                    aria-label={translate("settings.avatarInputLabel")}
                    className="sr-only"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        // Clearing lets the same file be picked again after a failed upload.
                        event.target.value = "";

                        if (file) {
                            void run({
                                body: file,
                                headers: {
                                    "content-type": file.type
                                },
                                method: "POST"
                            });
                        }
                    }}
                    ref={fileInput}
                    tabIndex={-1}
                    type="file"
                />
            </div>
            {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
};

const NameForm = ({ account, onSaved }: AccountFormProps): ReactNode => {
    // The prop is only the initial value; the user's edit wins once they type, so an
    // account refresh after saving never clobbers or resurrects stale text.
    const [edit, setEdit] = useState<string | null>(null);
    const name = edit ?? account.name;
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t: translate } = useTranslation();

    const save = async (): Promise<void> => {
        setBusy(true);
        setError(null);

        try {
            const result = await authClient.updateUser({ name: name.trim() });

            if (result.error) {
                setError(translate("errors.auth.updateFailed"));
            } else {
                onSaved();
                notifySuccess(translate("settings.saveSuccess"));
            }
        } catch {
            setError(translate("errors.auth.updateFailed"));
        }

        setBusy(false);
    };

    return (
        <form
            className="space-y-2"
            onSubmit={(event) => {
                event.preventDefault();
                void save();
            }}
        >
            <label className="block text-sm font-medium" htmlFor="account-name">
                {translate("auth.usernameLabel")}
            </label>
            <div className="flex gap-2">
                <Input
                    autoComplete="nickname"
                    id="account-name"
                    onChange={(event) => {
                        setEdit(event.target.value);
                    }}
                    required
                    value={name}
                />
                <Button disabled={busy || name.trim() === ""} type="submit">
                    {translate("common.save")}
                </Button>
            </div>
            {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
        </form>
    );
};

const LanguageForm = (): ReactNode => {
    const { locale, setLocale } = useLocale();
    const { refresh } = useAccountContext();
    const { t: translate } = useTranslation();

    const change = (next: string | null): void => {
        if (!isLocale(next)) {
            return;
        }

        setLocale(next);
        meClient.api.me
            .$patch({
                json: {
                    locale: next
                }
            })
            .then((response) => {
                if (response.ok) {
                    refresh();
                }
            })
            .catch(() => {
                notifyError(errorMessage("auth.localeSaveFailed"));
            });
    };

    // Base UI resolves the trigger text from Root's items, so the raw value is shown without them.
    const languages = [
        {
            label: translate("settings.languageJa"),
            value: "ja"
        },
        {
            label: translate("settings.languageEn"),
            value: "en"
        }
    ] as const;

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium">{translate("settings.languageLabel")}</p>
            <Select items={languages} onValueChange={change} value={locale}>
                <SelectTrigger aria-label={translate("settings.languageLabel")} className="w-40">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {languages.map((language) => (
                        <SelectItem key={language.value} value={language.value}>
                            {language.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};

const AccountSettings = (): ReactNode => {
    const { account, refresh } = useAccountContext();
    const { t: translate } = useTranslation();

    return (
        <section className="space-y-4">
            <h2 className="text-lg font-semibold">{translate("settings.accountTitle")}</h2>
            {account ? (
                <>
                    <AvatarForm account={account} onSaved={refresh} />
                    <NameForm account={account} onSaved={refresh} />
                    <LanguageForm />
                </>
            ) : (
                <p className="text-muted-foreground">{translate("common.loading")}</p>
            )}
        </section>
    );
};

export { AccountSettings };
