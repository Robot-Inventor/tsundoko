import { sharedContent } from "./shareTarget";
import { type } from "arktype";

const pendingShareKey = "tsundoko:pending-share";

const pendingShare = type({
    content: sharedContent,
    requiresConfirmation: "boolean"
});

type PendingShare = typeof pendingShare.infer;

const savePendingShare = (pending: PendingShare): void => {
    sessionStorage.setItem(pendingShareKey, JSON.stringify(pending));
};

const takePendingShare = (): PendingShare | null => {
    const stored = sessionStorage.getItem(pendingShareKey);

    if (stored === null) {
        return null;
    }

    sessionStorage.removeItem(pendingShareKey);

    try {
        const parsed = pendingShare(JSON.parse(stored));

        return parsed instanceof type.errors ? null : parsed;
    } catch {
        return null;
    }
};

const hasPendingShare = (): boolean => sessionStorage.getItem(pendingShareKey) !== null;

export { hasPendingShare, savePendingShare, takePendingShare };
