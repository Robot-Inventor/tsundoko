// oxlint-disable import/max-dependencies -- Token settings combine API calls, dialogs, and locale-aware dates.
import { type ApiToken, type CreatedApiToken, deleteToken, listTokens } from "../lib/tokenClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { type ReactNode, useEffect, useState } from "react";
import { notifyError, notifySuccess } from "../lib/appToast";
import { Button } from "./ui/button";
import { CreateTokenDialog } from "./CreateTokenDialog";
import { errorMessage } from "../lib/errorMessage";
import { formatDate } from "../lib/dateFormat";
import { tokenPermissionLabelKeys } from "../lib/tokenPermissions";
import { useLocale } from "../hooks/useLocale";
import { useTranslation } from "react-i18next";

const refreshIncrement = 1;
const initialRefreshKey = 0;

interface CreatedTokenDialogProps {
    onClose: () => void;
    token: CreatedApiToken | null;
}

const CreatedTokenDialog = ({ onClose, token }: CreatedTokenDialogProps): ReactNode => {
    const { t: translate } = useTranslation();

    const copy = async (): Promise<void> => {
        if (!token) {
            return;
        }

        try {
            await navigator.clipboard.writeText(token.token);
            notifySuccess(translate("settings.tokenCopied"));
        } catch {
            notifyError(translate("settings.tokenCopyFailed"));
        }
    };

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    onClose();
                }
            }}
            open={token !== null}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{translate("settings.tokenCreated")}</DialogTitle>
                    <DialogDescription>{translate("settings.tokenCreatedDescription")}</DialogDescription>
                </DialogHeader>
                <code className="rounded-lg bg-muted p-3 text-xs break-all">{token?.token}</code>
                <DialogFooter className="flex-row justify-end">
                    <Button onClick={onClose} variant="outline">
                        {translate("common.done")}
                    </Button>
                    <Button
                        onClick={() => {
                            void copy();
                        }}
                    >
                        {translate("settings.tokenCopy")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

interface DeleteTokenDialogProps {
    onClose: () => void;
    onDeleted: () => void;
    token: ApiToken | null;
}

const DeleteTokenDialog = ({ onClose, onDeleted, token }: DeleteTokenDialogProps): ReactNode => {
    const [busy, setBusy] = useState(false);
    const { t: translate } = useTranslation();

    const remove = async (): Promise<void> => {
        if (!token) {
            return;
        }

        setBusy(true);

        try {
            await deleteToken(token.id);
            onClose();
            onDeleted();
            notifySuccess(translate("settings.tokenDeleted"));
        } catch {
            notifyError(translate("errors.token.saveFailed"));
        }

        setBusy(false);
    };

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    onClose();
                }
            }}
            open={token !== null}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{translate("settings.tokenDeleteTitle")}</DialogTitle>
                    <DialogDescription>
                        {translate("settings.tokenDeleteDescription", { name: token?.name ?? "" })}
                    </DialogDescription>
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
                        {translate("settings.tokenDelete")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

interface TokenListItemProps {
    onDelete: (token: ApiToken) => void;
    token: ApiToken;
}

const TokenListItem = ({ onDelete, token }: TokenListItemProps): ReactNode => {
    const { locale } = useLocale();
    const { t: translate } = useTranslation();

    const description = [
        translate("settings.tokenCreatedAt", {
            date: formatDate(locale, token.createdAt, translate("common.unknownDate"))
        }),
        token.expiresAt
            ? translate("settings.tokenExpiresAt", {
                  date: formatDate(locale, token.expiresAt, translate("common.unknownDate"))
              })
            : translate("settings.tokenNeverExpires"),
        translate("common.lastUsedAt", {
            date: formatDate(locale, token.lastRequest, translate("common.neverUsed"))
        })
    ].join(" · ");

    return (
        <li className="flex flex-wrap items-start justify-between gap-2 py-3">
            <div className="space-y-1">
                <p className="font-medium">{token.name}</p>
                <p className="text-xs text-muted-foreground">
                    {token.start ?? ""}… ·{" "}
                    {token.permissions.bookmarks
                        .map((action) => translate(tokenPermissionLabelKeys[action]))
                        .join(", ")}
                </p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Button
                onClick={() => {
                    onDelete(token);
                }}
                size="sm"
                variant="ghost"
            >
                {translate("settings.tokenDelete")}
            </Button>
        </li>
    );
};

const ApiTokenSettings = (): ReactNode => {
    const [tokens, setTokens] = useState<ApiToken[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [created, setCreated] = useState<CreatedApiToken | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ApiToken | null>(null);
    const [refreshKey, setRefreshKey] = useState(initialRefreshKey);
    const { t: translate } = useTranslation();

    useEffect(() => {
        let cancelled = false;

        listTokens()
            .then((loaded) => {
                if (!cancelled) {
                    setTokens(loaded);
                    setError(null);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setError(errorMessage("token.loadFailed"));
                }
            });

        return (): void => {
            cancelled = true;
        };
    }, [refreshKey]);

    const refresh = (): void => {
        setRefreshKey((key) => key + refreshIncrement);
    };

    return (
        <section className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">{translate("settings.tokenTitle")}</h2>
                <p className="text-sm text-muted-foreground">{translate("settings.tokenDescription")}</p>
            </div>
            {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
            {tokens && !tokens.length ? (
                <p className="text-sm text-muted-foreground">{translate("settings.tokenEmpty")}</p>
            ) : null}
            <ul className="divide-y">
                {tokens?.map((token) => (
                    <TokenListItem key={token.id} onDelete={setDeleteTarget} token={token} />
                ))}
            </ul>
            <Button
                onClick={() => {
                    setCreateOpen(true);
                }}
                variant="outline"
            >
                {translate("settings.tokenCreate")}
            </Button>
            <CreateTokenDialog
                onClose={() => {
                    setCreateOpen(false);
                }}
                onCreated={(token) => {
                    setCreated(token);
                    refresh();
                }}
                open={createOpen}
            />
            <CreatedTokenDialog
                onClose={() => {
                    setCreated(null);
                }}
                token={created}
            />
            <DeleteTokenDialog
                onClose={() => {
                    setDeleteTarget(null);
                }}
                onDeleted={refresh}
                token={deleteTarget}
            />
        </section>
    );
};

export { ApiTokenSettings };
