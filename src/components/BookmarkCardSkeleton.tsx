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
                {/* Two title lines plus the gap and three description lines; the space is left
                    empty because the description is not skeletonized. The last bar reserves the
                    tag row shown on sm and up. */}
                <Skeleton className="h-4 w-3/4 sm:mb-[4.125rem] sm:h-11 sm:w-full" />
                <Skeleton className="mt-1 hidden h-5 w-24 sm:block" />
            </CardHeader>
            <CardFooter className={footerLayoutClass}>
                <Skeleton className="h-3 w-20 sm:h-4" />
            </CardFooter>
        </div>
    </Card>
);

export { BookmarkCardSkeleton };
