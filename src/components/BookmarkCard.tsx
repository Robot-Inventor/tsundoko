import { Card, CardFooter, CardHeader } from "./ui/Card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { EllipsisVerticalIcon, GlobeIcon, ImageOffIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
    cardLayoutClass,
    contentLayoutClass,
    footerLayoutClass,
    headerLayoutClass,
    thumbnailLayoutClass
} from "./bookmarkCardLayout";
import type { Bookmark } from "../lib/bookmark";
import { getBookmarkCardActions } from "./bookmarkCardActions";

const dateFormat = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" });

// Mobile: Feedly/X-style media object (thumbnail left, cropped to card height); sm and up: full-width thumbnail on top.
// h-full keeps the img stretched to the wrapper so wide screens keep the center crop; the
// wrapper owns the rounding because overflow-hidden clips it from the children.
const thumbnailClass = "aspect-video h-full w-full bg-muted object-cover";

interface BookmarkCardMenuProps {
    archived: boolean;
    bookmark: Bookmark;
}

const BookmarkCardMenu = ({ archived, bookmark }: BookmarkCardMenuProps): ReactNode => (
    // Hover-only action menu (touch devices use the long-press drawer); the stretched title
    // link sits underneath, so the trigger needs its own stacking level.
    <DropdownMenu>
        <DropdownMenuTrigger
            aria-label={`「${bookmark.title}」のメニューを開く`}
            // Top-left on the mobile thumbnail, top-right on the desktop thumbnail.
            className="pointer-events-none absolute left-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-full bg-black/50 text-white opacity-0 transition-[background-color,opacity] hover:bg-black/70 right-auto focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:focus-outline aria-expanded:pointer-events-auto aria-expanded:opacity-100 group-hover/card:pointer-events-auto group-hover/card:opacity-100 sm:left-auto sm:right-1.5 [@media(hover:none)]:hidden"
        >
            <EllipsisVerticalIcon aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            {getBookmarkCardActions(archived, bookmark).map(({ icon: Icon, label, onSelect, variant }) => (
                <DropdownMenuItem key={label} onClick={onSelect} variant={variant ?? "default"}>
                    <Icon aria-hidden="true" />
                    {label}
                </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
    </DropdownMenu>
);

interface BookmarkCardProps {
    archived: boolean;
    bookmark: Bookmark;
}

const BookmarkCard = ({ archived, bookmark }: BookmarkCardProps): ReactNode => {
    const [thumbnailFailed, setThumbnailFailed] = useState(false);
    const [faviconFailed, setFaviconFailed] = useState(false);
    const hasThumbnail = bookmark.thumbnailFit === "top" || bookmark.thumbnailUrl !== null;

    // sm:border instead of the base ring: the grid item's overflow-clip cuts a ring painted
    // outside the card once it fills the row, and an inset ring would be covered by the
    // flush thumbnail; a real border sits in the card's own border box, which overflow-hidden never clips.
    // The card spans its full cell on mobile (the grid is full-bleed there) and stays
    // transparent; the swipe margins live on the wrapping swipe container.
    return (
        <Card className={cardLayoutClass}>
            <div className={thumbnailLayoutClass}>
                {hasThumbnail && !thumbnailFailed ? (
                    <img
                        alt=""
                        className={`${thumbnailClass}${bookmark.thumbnailFit === "top" ? " object-top" : ""}`}
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

                <BookmarkCardMenu archived={archived} bookmark={bookmark} />
            </div>

            <div className={contentLayoutClass}>
                <CardHeader className={headerLayoutClass}>
                    <h2 className="font-heading text-base leading-snug font-semibold">
                        <a
                            className="block rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:focus-outline"
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

                <CardFooter className={footerLayoutClass}>
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

export { BookmarkCard };
