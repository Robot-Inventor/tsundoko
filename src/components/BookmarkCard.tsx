import { Card, CardFooter, CardHeader } from "./ui/Card";
import { GlobeIcon, ImageOffIcon } from "lucide-react";
import type { SavedBookmark } from "../lib/bookmark";
import { useState } from "react";

interface Bookmark extends Omit<SavedBookmark, "addedAt"> {
    addedAt: Date;
}

const dateFormat = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" });

// Mobile: Feedly/X-style media object (thumbnail left, cropped to card height); sm and up: full-width thumbnail on top.
const thumbnailClass = "aspect-video w-2/5 shrink-0 self-stretch rounded-lg bg-muted sm:w-full sm:rounded-none";

const BookmarkCard = ({ bookmark }: { bookmark: Bookmark }): React.JSX.Element => {
    const [thumbnailFailed, setThumbnailFailed] = useState(false);
    const [faviconFailed, setFaviconFailed] = useState(false);
    const hasThumbnail = bookmark.thumbnailFit === "top" || bookmark.thumbnailUrl !== null;

    return (
        <Card className="flex h-21 flex-row gap-3 overflow-visible rounded-none bg-transparent ring-0 sm:h-full sm:flex-col sm:gap-4 sm:overflow-hidden sm:rounded-xl sm:bg-card sm:ring-1 sm:ring-foreground/10">
            {hasThumbnail && !thumbnailFailed ? (
                <img
                    alt=""
                    className={`${thumbnailClass} object-cover${bookmark.thumbnailFit === "top" ? " object-top" : ""}`}
                    decoding="async"
                    loading="lazy"
                    onError={() => {
                        setThumbnailFailed(true);
                    }}
                    src={`/api/thumbnail?id=${bookmark.id}`}
                />
            ) : (
                <div className={`${thumbnailClass} grid place-items-center text-muted-foreground`}>
                    <ImageOffIcon aria-hidden="true" className="size-7" />
                </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col pr-3 sm:gap-4 sm:p-0">
                <CardHeader className="px-0 sm:px-4">
                    <h2 className="font-heading text-base leading-snug font-semibold">
                        <a
                            className="block rounded-sm underline-offset-4 hover:underline focus-visible:focus-outline"
                            href={bookmark.url}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            <span className="line-clamp-3 wrap-anywhere sm:line-clamp-2">{bookmark.title}</span>
                            <span className="sr-only">（新しいタブで開きます）</span>
                        </a>
                    </h2>
                    {bookmark.description && (
                        <p className="hidden wrap-anywhere text-muted-foreground sm:line-clamp-3">
                            {bookmark.description}
                        </p>
                    )}
                </CardHeader>

                <CardFooter className="mt-auto border-t-0 bg-transparent p-0 sm:border-t sm:bg-muted/50 sm:p-4">
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
            </div>
        </Card>
    );
};

export { type Bookmark, BookmarkCard };
