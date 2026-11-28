import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "./ui/alert-dialog";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface TagConfirmDialogProps {
    busy: boolean;
    confirmLabel: string;
    description: string;
    onCancel: () => void;
    onClosed?: (() => void) | undefined;
    onConfirm: () => void;
    open: boolean;
    title: string;
    variant: "default" | "destructive";
}

// Delete and merge share one confirmation shell; only their wording and emphasis differ.
const TagConfirmDialog = ({
    busy,
    confirmLabel,
    description,
    onCancel,
    onClosed,
    onConfirm,
    open,
    title,
    variant
}: TagConfirmDialogProps): ReactNode => {
    const { t: translate } = useTranslation();

    return (
        <AlertDialog
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    onCancel();
                }
            }}
            onOpenChangeComplete={(nextOpen) => {
                if (!nextOpen) {
                    onClosed?.();
                }
            }}
            open={open}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>{translate("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction disabled={busy} onClick={onConfirm} variant={variant}>
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export { TagConfirmDialog };
