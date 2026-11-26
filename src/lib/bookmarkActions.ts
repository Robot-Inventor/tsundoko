import type { Bookmark, BookmarkScope } from "./bookmark";
import { type SortBy, insertBySortBy } from "./bookmarkSort";
import { appToastManager, notifyError, toastTimeoutMs } from "./appToast";
import { bookmarkClient } from "./bookmarkClient";
import { errorMessage } from "./errorMessage";
import { i18n } from "./i18n";
import { useSyncExternalStore } from "react";

// The undo toast is shared by every action, so it needs a fixed id; errors dedupe under their own.
const actionToastId = "bookmark-action";
const errorToastId = "bookmark-action-error";

type BookmarkActionKind = "archive" | "unarchive" | "delete";

interface PendingBookmarkAction {
    bookmark: Bookmark;
    kind: BookmarkActionKind;
    timer: number;
}

const actionToasts = {
    archive: "bookmark.toastArchive",
    delete: "bookmark.toastDelete",
    unarchive: "bookmark.toastUnarchive"
} as const satisfies Record<BookmarkActionKind, string>;

let snapshot: ReadonlyMap<string, PendingBookmarkAction> = new Map();

// The undo toast is shared by every action, but only the newest action may close it: a
// commit for an older action must not truncate the newest action's undo window.
let toastOwner: PendingBookmarkAction | null = null;

const listeners = new Set<() => void>();

const replaceSnapshot = (next: ReadonlyMap<string, PendingBookmarkAction>): void => {
    snapshot = next;
    listeners.forEach((listener) => {
        listener();
    });
};

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);

    return (): void => {
        listeners.delete(listener);
    };
};

const getSnapshot = (): ReadonlyMap<string, PendingBookmarkAction> => snapshot;

// The scope the bookmark belongs to while the action is pending; deletes belong to neither.
const actionTargetsScope = (kind: BookmarkActionKind): BookmarkScope | null => {
    if (kind === "archive") {
        return "archived";
    }

    return kind === "unarchive" ? "active" : null;
};

const usePendingBookmarkActions = (): ReadonlyMap<string, PendingBookmarkAction> =>
    useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

// Applies the pending actions to a fetched list: bookmarks acted on leave the list at once,
// and ones moved into this scope appear even before their commit reaches the server.
interface ApplyPendingActionsInput {
    bookmarks: Bookmark[];
    pending: ReadonlyMap<string, PendingBookmarkAction>;
    scope: BookmarkScope;
    sortBy: SortBy;
}

const applyPendingActions = ({ bookmarks, pending, scope, sortBy }: ApplyPendingActionsInput): Bookmark[] => {
    if (!pending.size) {
        return bookmarks;
    }

    const movedIn: Bookmark[] = [];
    const movedOutIds = new Set<string>();

    for (const action of pending.values()) {
        const targetScope = actionTargetsScope(action.kind);

        if (targetScope === null) {
            movedOutIds.add(action.bookmark.id);
        } else if (targetScope === scope) {
            movedIn.push(action.bookmark);
        } else {
            movedOutIds.add(action.bookmark.id);
        }
    }

    // A committed action's entry keeps hiding the stale copy that fetched lists may still contain.
    const movedInIds = new Set(movedIn.map((bookmark) => bookmark.id));

    const kept = bookmarks.filter((bookmark) => !movedOutIds.has(bookmark.id) && !movedInIds.has(bookmark.id));

    return movedIn.reduce((list, bookmark) => insertBySortBy(list, bookmark, sortBy), kept);
};

const sendActionRequest = (action: PendingBookmarkAction): Promise<{ ok: boolean }> => {
    const params = {
        param: {
            id: action.bookmark.id
        }
    } as const;

    if (action.kind === "delete") {
        return bookmarkClient.api.bookmarks[":id"].$delete(params);
    }

    return bookmarkClient.api.bookmarks[":id"].$patch({
        ...params,
        json: {
            // A Date serializes to the ISO string the server's date morph expects.
            archivedAt: action.kind === "archive" ? new Date() : null
        }
    });
};

const commitAction = async (id: string, action: PendingBookmarkAction): Promise<void> => {
    // A newer action for this bookmark may have replaced this one while its timer ran.
    if (snapshot.get(id) !== action) {
        return;
    }

    // Only the action that currently owns the shared toast may close it. Other actions may
    // still be pending with no visible toast, and their commits must not close a newer one.
    if (toastOwner === action) {
        toastOwner = null;
        // Base UI pauses its auto-dismiss while hovered; timeout: 0 makes the commit timer
        // the only automatic clock. A user-initiated close has its own onClose path below.
        appToastManager.close(actionToastId);
    }

    const response = await sendActionRequest(action).catch(() => null);

    // The undo click may have removed the entry while the request was in flight.
    if (snapshot.get(id) !== action) {
        return;
    }

    if (!response?.ok) {
        // Roll the optimistic update back so the bookmark reappears in its original place.
        const next = new Map(snapshot);
        next.delete(id);
        replaceSnapshot(next);
        notifyError(errorMessage("bookmark.actionFailed"), errorToastId);
    }
    // On success the entry stays: it keeps hiding the stale copy in already-loaded lists.
};

const undoBookmarkAction = (id: string): void => {
    const action = snapshot.get(id);

    if (!action) {
        return;
    }

    clearTimeout(action.timer);
    const next = new Map(snapshot);
    next.delete(id);
    replaceSnapshot(next);

    if (toastOwner === action) {
        toastOwner = null;
        appToastManager.close(actionToastId);
    }
};

const requestBookmarkAction = (kind: BookmarkActionKind, bookmark: Bookmark): void => {
    const previous = snapshot.get(bookmark.id);

    if (previous) {
        clearTimeout(previous.timer);
    }

    const action: PendingBookmarkAction = {
        bookmark,
        kind,
        timer: window.setTimeout(() => {
            void commitAction(bookmark.id, action);
        }, toastTimeoutMs)
    };

    const next = new Map(snapshot);
    next.set(bookmark.id, action);
    replaceSnapshot(next);

    appToastManager.add({
        actionProps: {
            children: i18n.t("common.undo"),
            onClick: () => {
                undoBookmarkAction(bookmark.id);
            }
        },
        id: actionToastId,
        onClose: () => {
            // The × button, a swipe, or Escape dismisses the toast: send the request now instead
            // of leaving an invisible pending action until the 5 s timer expires.
            if (toastOwner !== action || snapshot.get(bookmark.id) !== action) {
                return;
            }

            toastOwner = null;
            clearTimeout(action.timer);
            void commitAction(bookmark.id, action);
        },
        // Base UI would pause its own dismissal while hovered; timeout: 0 hands the
        // whole visibility window over to the commit timer above.
        timeout: 0,
        title: i18n.t(actionToasts[kind], { title: bookmark.title })
    });

    toastOwner = action;
};

export { type BookmarkActionKind, applyPendingActions, requestBookmarkAction, usePendingBookmarkActions };
