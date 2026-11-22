import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

const Skeleton = ({ className, ...props }: React.ComponentProps<"div">): ReactNode => (
    <div
        className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)}
        data-slot="skeleton"
        {...props}
    />
);

export { Skeleton };
