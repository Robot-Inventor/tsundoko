import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { type PasskeyError, type PasskeySummary, passkeyMessages, toPasskeyError } from "../lib/passkey";
import { type ReactNode, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/Input";
import { PencilIcon } from "lucide-react";
import { authClient } from "../lib/authClient";
import { formatDate } from "../lib/dateFormat";
import { meClient } from "../lib/meClient";
import { type } from "arktype";

const deleteErrorBody = type({ code: "string", error: "string" });

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

    const save = async (): Promise<void> => {
        setBusy(true);
        setError(null);

        try {
            const result = await authClient.passkey.updatePasskey({ id: passkeyId, name: value.trim() });

            if (result.error) {
                setError(toPasskeyError(result.error).message);

                return;
            }

            onClose();
            onRenamed();
        } catch {
            setError(passkeyMessages.saveFailed);
        } finally {
            setBusy(false);
        }
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
                    <DialogTitle>パスキー名を変更</DialogTitle>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save();
                    }}
                >
                    <Input
                        aria-label="パスキー名"
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
                            キャンセル
                        </Button>
                        <Button disabled={busy || value.trim() === ""} type="submit">
                            保存
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
                const failure = deleteErrorBody(await response.json());

                if (failure instanceof type.errors) {
                    onError({
                        code: "",
                        message: passkeyMessages.saveFailed
                    });
                } else {
                    onError({
                        code: failure.code,
                        message: failure.error
                    });
                }
            }
        } catch {
            onError({
                code: "",
                message: passkeyMessages.saveFailed
            });
        } finally {
            setBusy(false);
            onClose();
        }
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
                    <DialogTitle>パスキーを削除</DialogTitle>
                    <DialogDescription>
                        「{name}」を削除します。このパスキーではログインできなくなります。
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-row justify-end">
                    <Button onClick={onClose} type="button" variant="outline">
                        キャンセル
                    </Button>
                    <Button
                        disabled={busy}
                        onClick={() => {
                            void remove();
                        }}
                        variant="destructive"
                    >
                        削除
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

    return (
        <div className="flex flex-wrap items-start justify-between gap-3 py-4">
            <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1">
                    <p className="truncate font-medium">{passkey.name}</p>
                    <Button
                        aria-label={`${passkey.name}の名前を変更`}
                        onClick={() => {
                            setRenaming(true);
                        }}
                        size="icon-sm"
                        variant="ghost"
                    >
                        <PencilIcon aria-hidden="true" />
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">作成日: {formatDate(passkey.createdAt)}</p>
                <p className="text-xs text-muted-foreground">最終使用日: {formatDate(passkey.lastUsedAt, "未使用")}</p>
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
                    削除
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
                name={passkey.name}
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
