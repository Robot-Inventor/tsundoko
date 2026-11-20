import { cn } from "../../lib/utils";

const Card = ({ className, ...props }: React.ComponentProps<"article">): React.JSX.Element => (
    <article
        className={cn(
            "group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10",
            className
        )}
        data-slot="card"
        {...props}
    />
);

const CardHeader = (props: React.ComponentProps<"header">): React.JSX.Element => (
    <header className="grid gap-1.5 px-4" data-slot="card-header" {...props} />
);

const CardFooter = (props: React.ComponentProps<"footer">): React.JSX.Element => (
    <footer
        className="mt-auto flex items-center justify-between gap-2 border-t bg-muted/50 p-4 text-xs text-muted-foreground"
        data-slot="card-footer"
        {...props}
    />
);

export { Card, CardFooter, CardHeader };
