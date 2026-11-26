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

// Deleting is offered only while another passkey exists, so the account keeps a way to sign in.
// The server keeps the same invariant independently (src/lib/passkeyStore.ts).
const minimumPasskeysForDeletion = 2;

// Better Auth reports a server rejection as a code plus an optional message. The settings UI maps
// the code to a translated message and keep the raw message for library-generated errors.
const toPasskeyError = (error: { code?: string | undefined; message?: string | undefined }): PasskeyError => ({
    code: error.code ?? "",
    message: error.message ?? ""
});

export { minimumPasskeysForDeletion, type PasskeyError, type PasskeySummary, toPasskeyError };
