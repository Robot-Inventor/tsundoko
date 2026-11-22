import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

const Card = ({ className, ...props }: React.ComponentProps<"article">): ReactNode => (
    <article
        className={cn(
            "group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10",
            className
        )}
        data-slot="card"
        {...props}
    />
);

const CardHeader = ({ className, ...props }: React.ComponentProps<"header">): ReactNode => (
    <header className={cn("grid gap-1.5 px-4", className)} data-slot="card-header" {...props} />
);

const CardFooter = ({ className, ...props }: React.ComponentProps<"footer">): ReactNode => (
    <footer
        className={cn(
            "mt-auto flex items-center justify-between gap-2 border-t bg-muted/50 p-4 text-xs text-muted-foreground",
            className
        )}
        data-slot="card-footer"
        {...props}
    />
);

export { Card, CardFooter, CardHeader };
