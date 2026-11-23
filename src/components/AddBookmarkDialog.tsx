import { type Bookmark, bookmarkMessages, httpStatus } from "../lib/bookmark";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { type ReactNode, useRef, useState } from "react";
import { invalidBookmarkUrlMessage, maxBookmarkUrlLength, parseBookmarkUrl } from "../lib/bookmarkUrl";
import { Button } from "./ui/button";
import { Input } from "./ui/Input";
import { PlusIcon } from "lucide-react";
import { bookmarkClient } from "../lib/bookmarkClient";
import { cn } from "../lib/utils";
import { useSearchContext } from "../hooks/useSearch";

const formErrors = {
    duplicate: bookmarkMessages.duplicate,
    fetch: bookmarkMessages.fetchFailed,
    invalid: invalidBookmarkUrlMessage,
    save: bookmarkMessages.saveFailed
} as const;

type AddBookmarkResult = { bookmark: Bookmark } | { error: string };

const requestBookmark = async (url: URL): Promise<AddBookmarkResult> => {
    try {
        const response = await bookmarkClient.api.bookmarks.$post({
            json: {
                url: url.href
            }
        });

        if (response.ok) {
            const saved = await response.json();

            return {
                bookmark: {
                    ...saved,
                    addedAt: new Date(saved.addedAt)
                }
            };
        }

        if (response.status === httpStatus.conflict) {
            return {
                error: formErrors.duplicate
            };
        }

        if (response.status === httpStatus.badRequest) {
            return {
                error: formErrors.invalid
            };
        }

        if (response.status === httpStatus.badGateway) {
            return {
                error: formErrors.fetch
            };
        }

        return {
            error: formErrors.save
        };
    } catch {
        return {
            error: formErrors.save
        };
    }
};

interface BookmarkUrlFormProps {
    onAdded: (bookmark: Bookmark) => void;
}

const BookmarkUrlForm = ({ onAdded }: BookmarkUrlFormProps): ReactNode => {
    const [input, setInput] = useState("");
    const [error, setError] = useState("");
    const [adding, setAdding] = useState(false);
    const urlInput = useRef<HTMLInputElement>(null);

    const addBookmark = async (): Promise<void> => {
        if (adding) {
            return;
        }

        setError("");
        const url = parseBookmarkUrl(input);

        if (!url) {
            setError(formErrors.invalid);
            urlInput.current?.focus();

            return;
        }

        setAdding(true);
        const result = await requestBookmark(url);
        setAdding(false);

        if ("error" in result) {
            setError(result.error);

            return;
        }

        setInput("");
        onAdded(result.bookmark);
    };

    return (
        <form
            className="grid gap-2"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                void addBookmark();
            }}
        >
            <div className="flex items-start gap-2">
                <Input
                    aria-describedby={error && "add-bookmark-error"}
                    aria-invalid={Boolean(error)}
                    aria-label="追加するページのURL"
                    autoCapitalize="none"
                    autoComplete="url"
                    autoCorrect="off"
                    className="h-10 flex-1"
                    maxLength={maxBookmarkUrlLength}
                    name="url"
                    onChange={(event) => {
                        setInput(event.currentTarget.value);
                        setError("");
                    }}
                    placeholder="追加するURLを入力"
                    readOnly={adding}
                    ref={urlInput}
                    required
                    spellCheck={false}
                    type="url"
                    value={input}
                />
                <Button className="h-10 w-20 shrink-0 px-2" disabled={adding} type="submit">
                    {adding ? "取得中…" : "追加"}
                </Button>
            </div>
            {error && (
                <p className="text-sm wrap-anywhere text-destructive" id="add-bookmark-error" role="alert">
                    {error}
                </p>
            )}
            <p aria-live="polite" className="sr-only">
                {adding ? "ページの情報を取得しています。" : ""}
            </p>
        </form>
    );
};

interface AddBookmarkDialogProps {
    onAdd: (bookmark: Bookmark) => void;
}

const AddBookmarkDialog = ({ onAdd }: AddBookmarkDialogProps): ReactNode => {
    const search = useSearchContext();
    const [open, setOpen] = useState(false);
    const inactive = open || search.searchOpen;

    return (
        <Dialog onOpenChange={setOpen} open={open}>
            <DialogTrigger render=<Button className="hidden md:inline-flex" />>
                <PlusIcon aria-hidden="true" />
                追加
            </DialogTrigger>
            <DialogTrigger
                aria-label="ブックマークを追加"
                inert={inactive}
                render=<Button
                    className={cn(
                        "fixed right-6 bottom-6 z-30 size-14 rounded-full shadow-lg transition-[opacity,scale] duration-200 md:hidden",
                        inactive && "scale-50 opacity-0"
                    )}
                    size="icon"
                />
            >
                <PlusIcon aria-hidden="true" className="size-6" />
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>ブックマークを追加</DialogTitle>
                </DialogHeader>
                <BookmarkUrlForm
                    onAdded={(bookmark) => {
                        setOpen(false);
                        onAdd(bookmark);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
};

export { AddBookmarkDialog };
