import { Card, CardFooter, CardHeader } from "./ui/Card";
import { GlobeIcon, ImageOffIcon } from "lucide-react";
import type { BookmarkPreview } from "../lib/bookmark";
import { useState } from "react";

interface Bookmark extends BookmarkPreview {
    addedAt: Date;
    id: string;
}

const dateFormat = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" });

const BookmarkCard = ({ bookmark }: { bookmark: Bookmark }): React.JSX.Element => {
    const [thumbnailFailed, setThumbnailFailed] = useState(false);
    const [faviconFailed, setFaviconFailed] = useState(false);

    return (
        <Card className="h-full">
            {bookmark.thumbnailUrl && !thumbnailFailed ? (
                <img
                    alt=""
                    className="aspect-video w-full bg-muted object-cover"
                    decoding="async"
                    loading="lazy"
                    onError={() => {
                        setThumbnailFailed(true);
                    }}
                    src={`/api/thumbnail?id=${bookmark.id}`}
                />
            ) : (
                <div className="grid aspect-video place-items-center bg-muted text-muted-foreground">
                    <ImageOffIcon aria-hidden="true" className="size-7" />
                </div>
            )}

            <CardHeader>
                <h2 className="font-heading text-base leading-snug font-semibold">
                    <a
                        className="block rounded-sm underline-offset-4 hover:underline focus-visible:focus-outline"
                        href={bookmark.url}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        <span className="line-clamp-2 wrap-anywhere">{bookmark.title}</span>
                        <span className="sr-only">（新しいタブで開きます）</span>
                    </a>
                </h2>
                {bookmark.description && (
                    <p className="line-clamp-3 wrap-anywhere text-muted-foreground">{bookmark.description}</p>
                )}
            </CardHeader>

            <CardFooter>
                <span className="flex min-w-0 items-center gap-1.5">
                    {faviconFailed ? (
                        <GlobeIcon aria-hidden="true" className="size-4 shrink-0" />
                    ) : (
                        <img
                            alt=""
                            className="size-4 shrink-0 rounded-full object-cover"
                            decoding="async"
                            height={16}
                            loading="lazy"
                            onError={() => {
                                setFaviconFailed(true);
                            }}
                            src={`/api/favicon?id=${bookmark.id}`}
                            width={16}
                        />
                    )}
                    <span className="truncate">{bookmark.siteName}</span>
                </span>
                <time className="shrink-0" dateTime={bookmark.addedAt.toISOString()}>
                    {dateFormat.format(bookmark.addedAt)}
                </time>
            </CardFooter>
        </Card>
    );
};

export { type Bookmark, BookmarkCard };
