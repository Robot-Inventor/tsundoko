import { type SharedContent, sharedContent } from "./shareTarget";
import { type } from "arktype";

const pendingShareKey = "tsundoko:pending-share";

const savePendingShare = (content: SharedContent): void => {
    sessionStorage.setItem(pendingShareKey, JSON.stringify(content));
};

const takePendingShare = (): SharedContent | null => {
    const stored = sessionStorage.getItem(pendingShareKey);

    if (stored === null) {
        return null;
    }

    sessionStorage.removeItem(pendingShareKey);

    try {
        const parsed = sharedContent(JSON.parse(stored));

        return parsed instanceof type.errors ? null : parsed;
    } catch {
        return null;
    }
};

const hasPendingShare = (): boolean => sessionStorage.getItem(pendingShareKey) !== null;

export { hasPendingShare, savePendingShare, takePendingShare };
