// oxlint-disable import/max-dependencies -- The card handles rename, deletion, and locale-aware labels.
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { type PasskeyError, type PasskeySummary, toPasskeyError } from "../lib/passkey";
import { type ReactNode, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/Input";
import { PencilIcon } from "lucide-react";
import { authClient } from "../lib/authClient";
import { authErrorMessage } from "../lib/errorMessage";
import { formatDate } from "../lib/dateFormat";
import { formatPasskeyName } from "../lib/localizedNames";
import { meClient } from "../lib/meClient";
import { type } from "arktype";
import { useLocale } from "../hooks/useLocale";
import { useTranslation } from "react-i18next";

const deleteErrorBody = type({
    error: {
        code: "string"
    }
});

interface RenameDialogProps {
    name: string;
    onClose: () => void;
    onRenamed: () => void;
    open: boolean;
    passkeyId: string;
}

const RenameDialog = ({ name, onClose, onRenamed, open, passkeyId }: RenameDialogProps): ReactNode => {
    const [value, setValue] = useState(name);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t: translate } = useTranslation();

    const save = async (): Promise<void> => {
        setBusy(true);
        setError(null);

        try {
            const result = await authClient.passkey.updatePasskey({ id: passkeyId, name: value.trim() });

            if (result.error) {
                setError(authErrorMessage(toPasskeyError(result.error), "passkey.saveFailed"));
            } else {
                onClose();
                onRenamed();
            }
        } catch {
            setError(translate("errors.passkey.saveFailed"));
        }

        setBusy(false);
    };

    const close = (): void => {
        // Discard an abandoned edit so reopening starts from the saved name.
        setValue(name);
        onClose();
    };

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    close();
                }
            }}
            open={open}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{translate("passkey.renameTitle")}</DialogTitle>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save();
                    }}
                >
                    <Input
                        aria-label={translate("passkey.nameLabel")}
                        onChange={(event) => {
                            setValue(event.target.value);
                        }}
                        required
                        value={value}
                    />
                    {error ? (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    ) : null}
                    <DialogFooter className="flex-row justify-end">
                        <Button onClick={close} type="button" variant="outline">
                            {translate("common.cancel")}
                        </Button>
                        <Button disabled={busy || value.trim() === ""} type="submit">
                            {translate("common.save")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

interface DeleteDialogProps {
    name: string;
    onClose: () => void;
    onDeleted: () => void;
    onError: (error: PasskeyError) => void;
    open: boolean;
    passkeyId: string;
}

const DeleteDialog = ({ name, onClose, onDeleted, onError, open, passkeyId }: DeleteDialogProps): ReactNode => {
    const [busy, setBusy] = useState(false);
    const { t: translate } = useTranslation();

    const remove = async (): Promise<void> => {
        setBusy(true);

        try {
            const response = await meClient.api.passkeys[":id"].$delete({
                param: {
                    id: passkeyId
                }
            });

            if (response.ok) {
                onDeleted();
            } else {
                const failure = deleteErrorBody(await response.json().catch(() => null));

                onError({
                    code: failure instanceof type.errors ? "" : failure.error.code,
                    message: ""
                });
            }
        } catch {
            onError({ code: "", message: "" });
        }

        setBusy(false);
        onClose();
    };

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    onClose();
                }
            }}
            open={open}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{translate("passkey.deleteTitle")}</DialogTitle>
                    <DialogDescription>{translate("passkey.deleteDescription", { name })}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-row justify-end">
                    <Button onClick={onClose} type="button" variant="outline">
                        {translate("common.cancel")}
                    </Button>
                    <Button
                        disabled={busy}
                        onClick={() => {
                            void remove();
                        }}
                        variant="destructive"
                    >
                        {translate("common.delete")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

interface PasskeyCardProps {
    canDelete: boolean;
    // Deleting needs a fresh sign-in, so the button stays disabled while the banner explains why.
    deleteAllowed: boolean;
    onChanged: () => void;
    onError: (error: PasskeyError) => void;
    passkey: PasskeySummary;
}

const PasskeyCard = ({ canDelete, deleteAllowed, onChanged, onError, passkey }: PasskeyCardProps): ReactNode => {
    const [renaming, setRenaming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { locale } = useLocale();
    const { t: translate } = useTranslation();
    const name = formatPasskeyName(passkey.name, locale, translate("passkey.defaultName"));

    return (
        <div className="flex flex-wrap items-start justify-between gap-3 py-4">
            <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1">
                    <p className="truncate font-medium">{name}</p>
                    <Button
                        aria-label={translate("common.renamePasskeyLabel", { name })}
                        onClick={() => {
                            setRenaming(true);
                        }}
                        size="icon-sm"
                        variant="ghost"
                    >
                        <PencilIcon aria-hidden="true" />
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    {translate("common.createdAt", {
                        date: formatDate(locale, passkey.createdAt, translate("common.unknownDate"))
                    })}
                </p>
                <p className="text-xs text-muted-foreground">
                    {translate("common.lastUsedAt", {
                        date: formatDate(locale, passkey.lastUsedAt, translate("common.neverUsed"))
                    })}
                </p>
            </div>
            {canDelete ? (
                <Button
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={!deleteAllowed}
                    onClick={() => {
                        setDeleting(true);
                    }}
                    size="sm"
                    variant="ghost"
                >
                    {translate("common.delete")}
                </Button>
            ) : null}
            <RenameDialog
                name={passkey.name}
                onClose={() => {
                    setRenaming(false);
                }}
                onRenamed={onChanged}
                open={renaming}
                passkeyId={passkey.id}
            />
            <DeleteDialog
                name={name}
                onClose={() => {
                    setDeleting(false);
                }}
                onDeleted={onChanged}
                onError={onError}
                open={deleting}
                passkeyId={passkey.id}
            />
        </div>
    );
};

export { PasskeyCard };
