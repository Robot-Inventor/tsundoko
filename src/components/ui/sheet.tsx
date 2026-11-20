import { Button } from "./button";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "../../lib/utils";

const Sheet = Dialog.Root;

const SheetTrigger = (props: Dialog.Trigger.Props): React.JSX.Element => (
    <Dialog.Trigger data-slot="sheet-trigger" {...props} />
);

const SheetContent = ({
    children,
    className,
    ...props
}: Omit<Dialog.Popup.Props, "className"> & { className?: string }): React.JSX.Element => (
    <Dialog.Portal>
        <Dialog.Backdrop
            data-slot="sheet-overlay"
            className="fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none supports-backdrop-filter:backdrop-blur-xs"
        />
        <Dialog.Popup
            data-slot="sheet-content"
            className={cn(
                "fixed inset-s-0 top-0 z-50 flex h-dvh w-3/4 max-w-xs flex-col gap-4 overflow-y-auto border-e bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition-[opacity,translate] duration-200 ease-in-out data-ending-style:-translate-x-full data-ending-style:opacity-0 data-starting-style:-translate-x-full data-starting-style:opacity-0 motion-reduce:transition-none",
                className
            )}
            {...props}
        >
            {children}
            <Dialog.Close
                aria-label="メニューを閉じる"
                data-slot="sheet-close"
                render=<Button className="absolute end-2 top-2 size-11" size="icon" variant="ghost" />
            >
                <XIcon aria-hidden="true" />
            </Dialog.Close>
        </Dialog.Popup>
    </Dialog.Portal>
);

const SheetTitle = (props: Dialog.Title.Props): React.JSX.Element => (
    <Dialog.Title className="px-4 pt-5 pe-14 text-base font-medium" data-slot="sheet-title" {...props} />
);

export { Sheet, SheetContent, SheetTitle, SheetTrigger };
