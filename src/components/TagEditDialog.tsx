// oxlint-disable import/max-dependencies -- The editor composes the form, confirmations, and mutation requests.
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { type ReactNode, type RefObject, useRef, useState } from "react";
import { type TagMutationFailure, requestTagDelete, requestTagUpdate } from "../lib/tagMutation";
import { type TagSummary, normalizeTagNames, tagNameKey } from "../lib/tags";
import { Button } from "./ui/button";
import { TagColorField } from "./TagColorField";
import { TagConfirmDialog } from "./TagConfirmDialog";
import { TagNameField } from "./TagNameField";
import { Trash2Icon } from "lucide-react";
import { notifyBookmarkChanged } from "../lib/bookmarkChange";
import { useTagListContext } from "../hooks/useTagList";
import { useTranslation } from "react-i18next";

const errorId = "tag-edit-error";

const failureKeys = {
    invalid: "errors.tag.invalidName",
    notFound: "errors.tag.notFound",
    rateLimit: "errors.rateLimit",
    save: "errors.tag.saveFailed"
} as const satisfies Record<TagMutationFailure, string>;

interface TagChange {
    from: string;
    to: string;
}

interface TagEditFormProps {
    busy: boolean;
    color: string | null;
    error: string;
    name: string;
    nameInvalid: boolean;
    nameInput: RefObject<HTMLInputElement | null>;
    onCancel: () => void;
    onColorChange: (color: string | null) => void;
    onDelete: () => void;
    onNameChange: (name: string) => void;
    onSubmit: () => void;
}

const TagEditForm = ({
    busy,
    color,
    error,
    name,
    nameInvalid,
    nameInput,
    onCancel,
    onColorChange,
    onDelete,
    onNameChange,
    onSubmit
}: TagEditFormProps): ReactNode => {
    const { t: translate } = useTranslation();

    return (
        <form
            autoComplete="off"
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
            }}
        >
            <TagNameField
                describedBy={error ? errorId : ""}
                disabled={busy}
                invalid={nameInvalid}
                name={name}
                nameInput={nameInput}
                onChange={onNameChange}
            />

            <TagColorField color={color} disabled={busy} onChange={onColorChange} />

            {error ? (
                <p className="text-sm wrap-anywhere text-destructive" id={errorId} role="alert">
                    {error}
                </p>
            ) : null}

            <DialogFooter>
                <Button
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20 sm:me-auto"
                    disabled={busy}
                    onClick={onDelete}
                    type="button"
                    variant="ghost"
                >
                    <Trash2Icon aria-hidden="true" />
                    {translate("tag.delete")}
                </Button>
                <Button disabled={busy} onClick={onCancel} type="button" variant="outline">
                    {translate("common.cancel")}
                </Button>
                <Button disabled={busy} type="submit">
                    {translate("common.save")}
                </Button>
            </DialogFooter>
        </form>
    );
};

interface TagEditDialogProps {
    onClose: () => void;
    onDeleted: (name: string) => void;
    onSaved: (change: TagChange) => void;
    tag: TagSummary;
}

// oxlint-disable-next-line max-lines-per-function -- The editor's state and its save, merge, and delete paths share one source of truth.
const TagEditDialog = ({ onClose, onDeleted, onSaved, tag }: TagEditDialogProps): ReactNode => {
    const [name, setName] = useState(tag.name);
    const [color, setColor] = useState(tag.color);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState("");
    const [nameInvalid, setNameInvalid] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [mergeName, setMergeName] = useState<string | null>(null);
    const nameInput = useRef<HTMLInputElement>(null);
    const tagList = useTagListContext();
    const { t: translate } = useTranslation();
    const busy = saving || deleting;

    const save = async (nextName: string, savedName = nextName): Promise<void> => {
        if (saving) {
            return;
        }

        setSaving(true);
        setError("");
        const result = await requestTagUpdate({ color, id: tag.id, name: nextName });
        setSaving(false);

        if ("failure" in result) {
            setError(translate(failureKeys[result.failure]));

            return;
        }

        tagList.reload();
        notifyBookmarkChanged();
        onSaved({ from: tag.name, to: savedName });
        onClose();
    };

    const submit = (): void => {
        const [nextName] = normalizeTagNames([name]) ?? [];

        if (!nextName) {
            setNameInvalid(true);
            setError(translate("errors.tag.invalidName"));
            nameInput.current?.focus();

            return;
        }

        setNameInvalid(false);
        setError("");

        const target = tagList.tags.find(
            (candidate) => candidate.id !== tag.id && tagNameKey(candidate.name) === tagNameKey(nextName)
        );

        if (target) {
            setMergeName(target.name);

            return;
        }

        void save(nextName);
    };

    const remove = async (): Promise<void> => {
        if (deleting) {
            return;
        }

        setDeleting(true);
        setError("");
        const result = await requestTagDelete(tag.id);
        setDeleting(false);

        if ("failure" in result) {
            setError(translate(failureKeys[result.failure]));

            return;
        }

        tagList.reload();
        notifyBookmarkChanged();
        onDeleted(tag.name);
        onClose();
    };

    return (
        <>
            <Dialog
                onOpenChange={(open) => {
                    // The request has already left the dialog; closing now would hide a change that still lands.
                    if (!open && !busy) {
                        onClose();
                    }
                }}
                open
            >
                <DialogContent initialFocus={nameInput} showCloseButton={!busy}>
                    <DialogHeader>
                        <DialogTitle>{translate("tag.editTitle")}</DialogTitle>
                    </DialogHeader>
                    <TagEditForm
                        busy={busy}
                        color={color}
                        error={error}
                        name={name}
                        nameInvalid={nameInvalid}
                        nameInput={nameInput}
                        onCancel={onClose}
                        onColorChange={(next) => {
                            setColor(next);
                            setError("");
                        }}
                        onDelete={() => {
                            setDeleteOpen(true);
                        }}
                        onNameChange={(next) => {
                            setName(next);
                            setNameInvalid(false);
                            setError("");
                        }}
                        onSubmit={submit}
                    />
                </DialogContent>
            </Dialog>

            <TagConfirmDialog
                busy={deleting}
                confirmLabel={translate("common.delete")}
                description={translate("tag.deleteDescription", { name: tag.name })}
                onCancel={() => {
                    setDeleteOpen(false);
                }}
                onConfirm={() => {
                    setDeleteOpen(false);
                    void remove();
                }}
                open={deleteOpen}
                title={translate("tag.deleteTitle")}
                variant="destructive"
            />

            <TagConfirmDialog
                busy={saving}
                confirmLabel={translate("tag.mergeConfirm")}
                description={translate("tag.mergeDescription", { name: mergeName ?? "" })}
                onCancel={() => {
                    setMergeName(null);
                }}
                onClosed={() => {
                    nameInput.current?.focus();
                }}
                onConfirm={() => {
                    const target = mergeName;

                    setMergeName(null);

                    if (target) {
                        void save(target, target);
                    }
                }}
                open={mergeName !== null}
                title={translate("tag.mergeTitle")}
                variant="default"
            />
        </>
    );
};

export { type TagChange, TagEditDialog };
