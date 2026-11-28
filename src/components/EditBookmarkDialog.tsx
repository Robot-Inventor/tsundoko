// oxlint-disable import/max-dependencies -- The dialog wires form state, tags, and the edit request.
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { type ReactNode, type RefObject, useRef, useState } from "react";
import { type UpdateBookmarkFailure, requestBookmarkUpdate } from "../lib/updateBookmark";
import type { Bookmark } from "../lib/bookmark";
import { Button } from "./ui/button";
import { Input } from "./ui/Input";
import { TagInput } from "./TagInput";
import { i18n } from "../lib/i18n";
import { notifyBookmarkChanged } from "../lib/bookmarkChange";
import { refreshPendingBookmark } from "../lib/bookmarkActions";
import { useLoginRedirect } from "../hooks/useLoginRedirect";
import { useTagListContext } from "../hooks/useTagList";
import { useTranslation } from "react-i18next";

const failureKeys = {
    invalid: "errors.bookmark.invalidTitle",
    notFound: "errors.bookmark.notFound",
    rateLimit: "errors.rateLimit",
    save: "errors.bookmark.saveFailed"
} as const satisfies Record<Exclude<UpdateBookmarkFailure, "auth">, string>;

const errorId = "edit-bookmark-error";
const titleInputId = "edit-bookmark-title";

const reportFailure = (
    failure: UpdateBookmarkFailure,
    redirectToLogin: () => void,
    setError: (message: string) => void
): void => {
    if (failure === "auth") {
        redirectToLogin();

        return;
    }

    setError(i18n.t(failureKeys[failure]));
};

interface EditBookmarkFormProps {
    bookmark: Bookmark;
    onCancel: () => void;
    onSaved: (bookmark: Bookmark) => void;
    onSavingChange: (saving: boolean) => void;
    saving: boolean;
    suggestions: string[];
    titleInput: RefObject<HTMLInputElement | null>;
}

const EditBookmarkForm = ({
    bookmark,
    onCancel,
    onSaved,
    onSavingChange,
    saving,
    suggestions,
    titleInput
}: EditBookmarkFormProps): ReactNode => {
    const [title, setTitle] = useState(bookmark.title);
    const [tagNames, setTagNames] = useState(bookmark.tags);
    const [error, setError] = useState("");
    // Only a blank title makes the field itself invalid; other failures are general messages.
    const [titleInvalid, setTitleInvalid] = useState(false);
    const redirectToLogin = useLoginRedirect();
    const { t: translate } = useTranslation();

    const save = async (): Promise<void> => {
        if (saving) {
            return;
        }

        const nextTitle = title.trim();

        if (!nextTitle) {
            setTitleInvalid(true);
            setError(i18n.t("errors.bookmark.invalidTitle"));
            titleInput.current?.focus();

            return;
        }

        setTitleInvalid(false);
        setError("");
        onSavingChange(true);
        const result = await requestBookmarkUpdate({
            id: bookmark.id,
            tags: tagNames,
            title: nextTitle
        });

        onSavingChange(false);

        if ("failure" in result) {
            reportFailure(result.failure, redirectToLogin, setError);

            return;
        }

        onSaved(result.bookmark);
    };

    return (
        <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                void save();
            }}
        >
            <div className="space-y-1">
                <label className="block text-sm font-medium" htmlFor={titleInputId}>
                    {translate("bookmark.titleLabel")}
                </label>
                <Input
                    aria-describedby={error ? errorId : ""}
                    aria-invalid={titleInvalid}
                    id={titleInputId}
                    onChange={(event) => {
                        setTitle(event.currentTarget.value);
                        setTitleInvalid(false);
                        setError("");
                    }}
                    readOnly={saving}
                    ref={titleInput}
                    required
                    value={title}
                />
            </div>
            <div className="space-y-1">
                <p className="text-sm font-medium">{translate("bookmark.tagsLabel")}</p>
                <TagInput disabled={saving} onChange={setTagNames} suggestions={suggestions} value={tagNames} />
            </div>
            {error ? (
                <p className="text-sm wrap-anywhere text-destructive" id={errorId} role="alert">
                    {error}
                </p>
            ) : null}
            <DialogFooter className="flex-row justify-end">
                <Button disabled={saving} onClick={onCancel} type="button" variant="outline">
                    {translate("common.cancel")}
                </Button>
                <Button disabled={saving} type="submit">
                    {translate("common.save")}
                </Button>
            </DialogFooter>
        </form>
    );
};

interface EditBookmarkDialogProps {
    bookmark: Bookmark;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}

const EditBookmarkDialog = ({ bookmark, onOpenChange, open }: EditBookmarkDialogProps): ReactNode => {
    const [saving, setSaving] = useState(false);
    const titleInput = useRef<HTMLInputElement>(null);
    const tagList = useTagListContext();
    const { t: translate } = useTranslation();

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                // The request has already left the dialog; closing now would hide a change that still lands.
                if (!nextOpen && saving) {
                    return;
                }

                onOpenChange(nextOpen);
            }}
            open={open}
        >
            <DialogContent initialFocus={titleInput} showCloseButton={!saving}>
                <DialogHeader>
                    <DialogTitle>{translate("bookmark.editTitle")}</DialogTitle>
                </DialogHeader>
                <EditBookmarkForm
                    bookmark={bookmark}
                    onCancel={() => {
                        onOpenChange(false);
                    }}
                    onSaved={(updated) => {
                        onOpenChange(false);
                        refreshPendingBookmark(updated);
                        tagList.reload();
                        notifyBookmarkChanged();
                    }}
                    onSavingChange={setSaving}
                    saving={saving}
                    suggestions={tagList.tags.map((tag) => tag.name)}
                    titleInput={titleInput}
                />
            </DialogContent>
        </Dialog>
    );
};

export { EditBookmarkDialog };
