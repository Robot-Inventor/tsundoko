// oxlint-disable import/max-dependencies -- The dialog wires form state, validation, and locale.
import { type AddBookmarkFailure, requestBookmark } from "../lib/addBookmark";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { type ReactNode, useRef, useState } from "react";
import { maxBookmarkUrlLength, parseBookmarkUrl } from "../lib/bookmarkUrl";
import type { Bookmark } from "../lib/bookmark";
import { Button } from "./ui/button";
import { Input } from "./ui/Input";
import { PlusIcon } from "lucide-react";
import { TagInput } from "./TagInput";
import { cn } from "../lib/utils";
import { i18n } from "../lib/i18n";
import { useSearchContext } from "../hooks/useSearch";
import { useTagListContext } from "../hooks/useTagList";
import { useTranslation } from "react-i18next";

const formErrorKeys = {
    duplicate: "errors.bookmark.duplicate",
    fetch: "errors.bookmark.fetchFailed",
    invalid: "errors.bookmark.invalidUrl",
    rateLimit: "errors.rateLimit",
    save: "errors.bookmark.saveFailed"
} as const satisfies Record<AddBookmarkFailure, string>;

const errorId = "add-bookmark-error";

interface BookmarkUrlFormProps {
    initialTag: string | undefined;
    onAdded: (bookmark: Bookmark) => void;
    onCancel: () => void;
}

const BookmarkUrlForm = ({ initialTag, onAdded, onCancel }: BookmarkUrlFormProps): ReactNode => {
    const [input, setInput] = useState("");
    const [tagNames, setTagNames] = useState<string[]>(initialTag ? [initialTag] : []);
    const [error, setError] = useState("");
    const [adding, setAdding] = useState(false);
    const urlInput = useRef<HTMLInputElement>(null);
    const { tags } = useTagListContext();
    const { t: translate } = useTranslation();

    const addBookmark = async (): Promise<void> => {
        if (adding) {
            return;
        }

        setError("");
        const url = parseBookmarkUrl(input);

        if (!url) {
            setError(i18n.t("errors.bookmark.invalidUrl"));
            urlInput.current?.focus();

            return;
        }

        setAdding(true);
        const result = await requestBookmark(url, tagNames);
        setAdding(false);

        if ("failure" in result) {
            setError(i18n.t(formErrorKeys[result.failure]));

            return;
        }

        setInput("");
        setTagNames([]);
        onAdded(result.bookmark);
    };

    return (
        <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                void addBookmark();
            }}
        >
            <Input
                aria-describedby={error ? errorId : ""}
                aria-invalid={Boolean(error)}
                aria-label={translate("bookmark.urlLabel")}
                autoCapitalize="none"
                autoComplete="url"
                autoCorrect="off"
                maxLength={maxBookmarkUrlLength}
                name="url"
                onChange={(event) => {
                    setInput(event.currentTarget.value);
                    setError("");
                }}
                placeholder={translate("bookmark.urlPlaceholder")}
                readOnly={adding}
                ref={urlInput}
                required
                spellCheck={false}
                type="url"
                value={input}
            />
            <div className="space-y-1">
                <p className="text-sm font-medium">{translate("bookmark.tagsLabel")}</p>
                <TagInput
                    disabled={adding}
                    onChange={setTagNames}
                    suggestions={tags.map((tag) => tag.name)}
                    value={tagNames}
                />
            </div>
            {error ? (
                <p className="text-sm wrap-anywhere text-destructive" id={errorId} role="alert">
                    {error}
                </p>
            ) : null}
            <p aria-live="polite" className="sr-only">
                {adding ? translate("bookmark.fetchingStatus") : ""}
            </p>
            <DialogFooter className="flex-row justify-end">
                <Button onClick={onCancel} type="button" variant="outline">
                    {translate("common.cancel")}
                </Button>
                <Button disabled={adding} type="submit">
                    {adding ? translate("bookmark.fetchingButton") : translate("common.add")}
                </Button>
            </DialogFooter>
        </form>
    );
};

interface AddBookmarkDialogProps {
    initialTag?: string;
    onAdd: (bookmark: Bookmark) => void;
}

const AddBookmarkDialog = ({ initialTag, onAdd }: AddBookmarkDialogProps): ReactNode => {
    const search = useSearchContext();
    const [open, setOpen] = useState(false);
    const inactive = open || search.searchOpen;
    const { t: translate } = useTranslation();

    return (
        <Dialog onOpenChange={setOpen} open={open}>
            <DialogTrigger render=<Button className="hidden md:inline-flex" />>
                <PlusIcon aria-hidden="true" />
                {translate("common.add")}
            </DialogTrigger>
            <DialogTrigger
                aria-label={translate("bookmark.addTitle")}
                inert={inactive}
                render=<Button
                    className={cn(
                        "fixed right-6 bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg transition-[opacity,scale] duration-200 md:hidden",
                        inactive && "scale-50 opacity-0"
                    )}
                    size="icon"
                />
            >
                <PlusIcon aria-hidden="true" className="size-6" />
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{translate("bookmark.addTitle")}</DialogTitle>
                </DialogHeader>
                <BookmarkUrlForm
                    initialTag={initialTag}
                    onAdded={(bookmark) => {
                        setOpen(false);
                        onAdd(bookmark);
                    }}
                    onCancel={() => {
                        setOpen(false);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
};

export { AddBookmarkDialog };
