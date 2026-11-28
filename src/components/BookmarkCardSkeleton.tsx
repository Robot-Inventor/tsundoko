import { Card, CardFooter, CardHeader } from "./ui/Card";
import {
    cardLayoutClass,
    contentLayoutClass,
    footerLayoutClass,
    headerLayoutClass,
    thumbnailLayoutClass
} from "./bookmarkCardLayout";
import type { ReactNode } from "react";
import { Skeleton } from "./ui/skeleton";

// Mirrors BookmarkCard with one skeleton per content region: thumbnail, title, and site
// name. Reusing the card's wrappers keeps the loading rows the same size as the real ones.
const BookmarkCardSkeleton = (): ReactNode => (
    <Card className={cardLayoutClass}>
        <div className={thumbnailLayoutClass}>
            <Skeleton className="aspect-video h-full w-full rounded-none" />
        </div>
        <div className={contentLayoutClass}>
            <CardHeader className={headerLayoutClass}>
                {/* The shared header min-height reserves the title, description, and tag row;
                    the tag bar's mt-auto lands it where the real card's tags sit. */}
                <Skeleton className="h-4 w-3/4 sm:h-11 sm:w-full" />
                <Skeleton className="mt-auto hidden h-5 w-24 sm:block" />
            </CardHeader>
            <CardFooter className={footerLayoutClass}>
                <Skeleton className="h-3 w-20 sm:h-4" />
            </CardFooter>
        </div>
    </Card>
);

export { BookmarkCardSkeleton };
