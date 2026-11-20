import { type Bookmark, BookmarkCard } from "./BookmarkCard";
import { invalidBookmarkUrlMessage, maxBookmarkUrlLength, parseBookmarkUrl } from "../lib/bookmarkUrl";
import { useRef, useState } from "react";
import type { BookmarkPreviewApi } from "../bookmarkPreview";
import { Button } from "./ui/button";
import { Input } from "./ui/Input";
import { hc } from "hono/client";

const previewClient = hc<BookmarkPreviewApi>("/");
const formErrors = {
    duplicate: "このURLはすでに追加されています。",
    fetch: "ページの情報を取得できませんでした。URLを確認して再試行してください。",
    invalid: invalidBookmarkUrlMessage
} as const;

const formErrorMessages = Object.values(formErrors);

const bookmarkIdentity = (url: string): string => url.split("#")[0] ?? url;

const requestPreview = async (url: URL): Promise<Bookmark | null> => {
    try {
        const response = await previewClient.api["bookmark-preview"].$post({
            json: {
                url: url.href
            }
        });

        if (!response.ok) {
            return null;
        }

        return {
            ...(await response.json()),
            addedAt: new Date()
        };
    } catch {
        return null;
    }
};

interface BookmarkFormProps {
    bookmarks: Bookmark[];
    onAdd: (bookmark: Bookmark) => void;
}

const BookmarkForm = ({ bookmarks, onAdd }: BookmarkFormProps): React.JSX.Element => {
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
        const duplicate =
            url && bookmarks.some((bookmark) => bookmarkIdentity(bookmark.url) === bookmarkIdentity(url.href));

        if (!url || duplicate) {
            setError(url ? formErrors.duplicate : formErrors.invalid);

            urlInput.current?.focus();

            return;
        }

        setAdding(true);
        const bookmark = await requestPreview(url);
        setAdding(false);

        if (!bookmark) {
            setError(formErrors.fetch);

            return;
        }

        onAdd(bookmark);
        setInput("");
        setStatus("ブックマークを追加しました。");
    };

    const announcement = adding ? "ページの情報を取得しています。" : error || status;

    return (
        <form
            action="/api/bookmark-preview"
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

const BookmarkHome = (): React.JSX.Element => {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

    return (
        <>
            <BookmarkForm
                bookmarks={bookmarks}
                onAdd={(bookmark) => {
                    setBookmarks((current) => [bookmark, ...current]);
                }}
            />
            {bookmarks.length ? (
                <ul
                    aria-label="追加したブックマーク"
                    className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4"
                >
                    {bookmarks.map((bookmark) => (
                        <li className="min-w-0" key={bookmark.url}>
                            <BookmarkCard bookmark={bookmark} />
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-3 text-sm text-muted-foreground">まだブックマークはありません。</p>
            )}
        </>
    );
};

export { BookmarkHome };
