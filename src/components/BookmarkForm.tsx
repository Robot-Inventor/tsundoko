import { type Bookmark, bookmarkMessages } from "../lib/bookmark";
import { type ReactNode, useRef, useState } from "react";
import { invalidBookmarkUrlMessage, maxBookmarkUrlLength, parseBookmarkUrl } from "../lib/bookmarkUrl";
import { Button } from "./ui/button";
import { Input } from "./ui/Input";
import { bookmarkClient } from "../lib/bookmarkClient";

const formErrors = {
    duplicate: bookmarkMessages.duplicate,
    fetch: bookmarkMessages.fetchFailed,
    invalid: invalidBookmarkUrlMessage,
    save: bookmarkMessages.saveFailed
} as const;

const formErrorMessages = Object.values(formErrors);
const httpStatus = {
    badGateway: 502,
    badRequest: 400,
    conflict: 409
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

interface BookmarkFormProps {
    onAdd: (bookmark: Bookmark) => void;
}

const BookmarkForm = ({ onAdd }: BookmarkFormProps): ReactNode => {
    const [input, setInput] = useState("");
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [adding, setAdding] = useState(false);
    const urlInput = useRef<HTMLInputElement>(null);

    const addBookmark = async (): Promise<void> => {
        if (adding) {
            return;
        }

        setError("");
        setStatus("");
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

        onAdd(result.bookmark);
        setInput("");
        setStatus("ブックマークを追加しました。");
    };

    const announcement = adding ? "ページの情報を取得しています。" : error || status;

    return (
        <form
            action="/api/bookmarks"
            className="mt-4 max-w-2xl"
            method="post"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                void addBookmark();
            }}
        >
            <div className="flex items-start gap-2">
                <Input
                    aria-describedby={error && "bookmark-url-error"}
                    aria-invalid={Boolean(error)}
                    aria-label="追加するページのURL"
                    autoCapitalize="none"
                    autoComplete="url"
                    autoCorrect="off"
                    className="h-10 flex-1"
                    id="bookmark-url"
                    maxLength={maxBookmarkUrlLength}
                    name="url"
                    onChange={(event) => {
                        setInput(event.currentTarget.value);
                        setError("");
                        setStatus("");
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
            <div className="mt-2 grid text-sm wrap-anywhere text-destructive [&>p]:col-start-1 [&>p]:row-start-1">
                {/* Measure the tallest error at the current width before any error is shown. */}
                {formErrorMessages.map((message) => (
                    <p className="invisible" key={message}>
                        {message}
                    </p>
                ))}
                <p id="bookmark-url-error">{error}</p>
            </div>
            <p aria-live="polite" className="sr-only">
                {announcement}
            </p>
        </form>
    );
};

export { BookmarkForm };
