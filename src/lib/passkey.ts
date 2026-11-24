interface PasskeySummary {
    createdAt: string | null;
    id: string;
    lastUsedAt: string | null;
    name: string;
}

interface PasskeyError {
    code: string;
    message: string;
}

const passkeyMessages = {
    deleteLast: "最後のパスキーは削除できません。",
    loadFailed: "パスキーを読み込めませんでした。",
    notFound: "パスキーが見つかりませんでした。",
    reauthenticate: "セキュリティのため再ログインが必要です。",
    saveFailed: "パスキーを保存できませんでした。"
} as const;

// Deleting is offered only while another passkey exists, so the account keeps a way to sign in.
// The server keeps the same invariant independently (src/lib/passkeyStore.ts).
const minimumPasskeysForDeletion = 2;

// Better Auth reports a server rejection as a code plus an optional message; the settings UI decides
// what to do from the code, so both fields always exist.
const toPasskeyError = (error: { code?: string | undefined; message?: string | undefined }): PasskeyError => ({
    code: error.code ?? "",
    message: error.message ?? passkeyMessages.saveFailed
});

export { minimumPasskeysForDeletion, type PasskeyError, type PasskeySummary, passkeyMessages, toPasskeyError };
