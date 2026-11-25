import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { type ReactNode, useRef, useState } from "react";
import type { Account } from "../lib/meClient";
import { Button } from "./ui/button";
import { Input } from "./ui/Input";
import { authClient } from "../lib/authClient";
import { notifySuccess } from "../lib/appToast";
import { type } from "arktype";
import { useAccountContext } from "../hooks/useAccount";

const errorResponse = type({ error: "string" });

const avatarAccept = "image/png,image/jpeg,image/webp";

const avatarFailureMessage = "画像を変更できませんでした。";

const sendAvatar = async (request: RequestInit): Promise<string | null> => {
    try {
        const response = await fetch("/api/me/avatar", request);

        if (!response.ok) {
            const failure = errorResponse(await response.json());

            return failure instanceof type.errors ? avatarFailureMessage : failure.error;
        }

        return null;
    } catch {
        return avatarFailureMessage;
    }
};

interface AccountFormProps {
    account: Account;
    onSaved: () => void;
}

const AvatarForm = ({ account, onSaved }: AccountFormProps): ReactNode => {
    const fileInput = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = async (request: RequestInit): Promise<void> => {
        setBusy(true);
        setError(null);

        const failure = await sendAvatar(request);

        if (failure) {
            setError(failure);
        } else {
            onSaved();
            notifySuccess("アイコンを変更しました");
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
                        画像を変更
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
                            Gravatarに戻す
                        </Button>
                    ) : null}
                </div>
                <input
                    accept={avatarAccept}
                    aria-label="アイコン画像を選択"
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

    const save = async (): Promise<void> => {
        setBusy(true);
        setError(null);

        try {
            const result = await authClient.updateUser({ name: name.trim() });

            if (result.error) {
                setError("ユーザー名を保存できませんでした。");
            } else {
                onSaved();
                notifySuccess("保存しました");
            }
        } catch {
            setError("ユーザー名を保存できませんでした。");
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
                ユーザー名
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
                    保存
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

const AccountSettings = (): ReactNode => {
    const { account, refresh } = useAccountContext();

    return (
        <section className="space-y-4">
            <h2 className="text-lg font-semibold">アカウント</h2>
            {account ? (
                <>
                    <AvatarForm account={account} onSaved={refresh} />
                    <NameForm account={account} onSaved={refresh} />
                </>
            ) : (
                <p className="text-muted-foreground">読み込み中です。</p>
            )}
        </section>
    );
};

export { AccountSettings };
