import { Input as InputPrimitive } from "@base-ui/react/input";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

const Input = ({ className, ...props }: React.ComponentProps<"input">): ReactNode => (
    <InputPrimitive
        className={cn(
            "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base placeholder:text-muted-foreground focus-visible:focus-outline aria-invalid:border-destructive dark:bg-input/30 dark:focus-visible:outline-ring",
            className
        )}
        data-slot="input"
        {...props}
    />
);

export { Input };
