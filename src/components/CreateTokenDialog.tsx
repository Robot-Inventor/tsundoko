import { type CreatedApiToken, type TokenPermissions, createToken } from "../lib/tokenClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { type ReactNode, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/Input";
import { useTranslation } from "react-i18next";

const expiryOptions = ["1", "7", "30", "90", "custom", "never"] as const;
const minimumExpiryDays = 1;
const maximumExpiryDays = 365;
const defaultExpiry: ExpiryOption = "90";
const defaultCustomDays = "30";

type ExpiryOption = (typeof expiryOptions)[number];

const isExpiryOption = (value: string | null): value is ExpiryOption =>
    expiryOptions.some((option) => option === value);

const expiryDays = (option: ExpiryOption, customDays: string): number | null => {
    if (option === "never") {
        return null;
    }

    return option === "custom" ? Number(customDays) : Number(option);
};

interface TokenPermissionFieldsProps {
    onDeleteChange: (checked: boolean) => void;
    onReadChange: (checked: boolean) => void;
    onWriteChange: (checked: boolean) => void;
    readRequired: boolean;
    readSelected: boolean;
    remove: boolean;
    write: boolean;
}

const TokenPermissionFields = ({
    onDeleteChange,
    onReadChange,
    onWriteChange,
    readRequired,
    readSelected,
    remove,
    write
}: TokenPermissionFieldsProps): ReactNode => {
    const { t: translate } = useTranslation();

    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{translate("settings.tokenPermissionsLabel")}</legend>
            <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={readSelected} disabled={readRequired} onCheckedChange={onReadChange} />
                <span>
                    <span className="block">{translate("settings.tokenPermissionRead")}</span>
                    <span className="block text-muted-foreground">
                        {translate("settings.tokenPermissionReadDescription")}
                    </span>
                </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={write} onCheckedChange={onWriteChange} />
                <span>
                    <span className="block">{translate("settings.tokenPermissionWrite")}</span>
                    <span className="block text-muted-foreground">
                        {translate("settings.tokenPermissionWriteDescription")}
                    </span>
                </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={remove} onCheckedChange={onDeleteChange} />
                <span>
                    <span className="block">{translate("settings.tokenPermissionDelete")}</span>
                    <span className="block text-muted-foreground">
                        {translate("settings.tokenPermissionDeleteDescription")}
                    </span>
                </span>
            </label>
        </fieldset>
    );
};

interface ExpiryFieldProps {
    customDays: string;
    expiry: ExpiryOption;
    onCustomDaysChange: (value: string) => void;
    onExpiryChange: (value: ExpiryOption) => void;
}

const ExpiryField = ({ customDays, expiry, onCustomDaysChange, onExpiryChange }: ExpiryFieldProps): ReactNode => {
    const { t: translate } = useTranslation();

    const labelFor = (option: ExpiryOption): string => {
        if (option === "custom") {
            return translate("settings.tokenExpiryCustom");
        }

        if (option === "never") {
            return translate("settings.tokenExpiryUnlimited");
        }

        return translate("settings.tokenExpiryDays", { count: Number(option) });
    };

    const options = expiryOptions.map((option) => ({ label: labelFor(option), value: option }));

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium">{translate("settings.tokenExpiryLabel")}</p>
            <div className="flex flex-wrap items-center gap-2">
                <Select
                    items={options}
                    onValueChange={(value) => {
                        if (isExpiryOption(value)) {
                            onExpiryChange(value);
                        }
                    }}
                    value={expiry}
                >
                    <SelectTrigger aria-label={translate("settings.tokenExpiryLabel")} className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {expiry === "custom" ? (
                    <Input
                        aria-label={translate("settings.tokenCustomDaysLabel")}
                        className="w-24"
                        max={maximumExpiryDays}
                        min={minimumExpiryDays}
                        onChange={(event) => {
                            onCustomDaysChange(event.target.value);
                        }}
                        type="number"
                        value={customDays}
                    />
                ) : null}
            </div>
        </div>
    );
};

interface CreateTokenDialogProps {
    onClose: () => void;
    onCreated: (token: CreatedApiToken) => void;
    open: boolean;
}

// oxlint-disable-next-line max-lines-per-function -- The dialog is one cohesive form.
const CreateTokenDialog = ({ onClose, onCreated, open }: CreateTokenDialogProps): ReactNode => {
    const [name, setName] = useState("");
    const [read, setRead] = useState(true);
    const [write, setWrite] = useState(false);
    const [remove, setRemove] = useState(false);
    const [expiry, setExpiry] = useState<ExpiryOption>(defaultExpiry);
    const [customDays, setCustomDays] = useState(defaultCustomDays);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t: translate } = useTranslation();

    const readRequired = write || remove;
    const readSelected = read || readRequired;
    const selectedCount = Number(readSelected) + Number(write) + Number(remove);
    const days = expiryDays(expiry, customDays);
    const daysInvalid =
        days !== null && (!Number.isInteger(days) || days < minimumExpiryDays || days > maximumExpiryDays);

    const reset = (): void => {
        setName("");
        setRead(true);
        setWrite(false);
        setRemove(false);
        setExpiry(defaultExpiry);
        setCustomDays(defaultCustomDays);
        setError(null);
    };

    const submit = async (): Promise<void> => {
        if (!selectedCount) {
            setError(translate("settings.tokenPermissionsRequired"));

            return;
        }

        if (daysInvalid) {
            setError(translate("settings.tokenInvalidDays"));

            return;
        }

        const permissions: TokenPermissions = {
            bookmarks: [
                ...(readSelected ? (["read"] as const) : []),
                ...(write ? (["write"] as const) : []),
                ...(remove ? (["delete"] as const) : [])
            ]
        };

        setBusy(true);
        setError(null);

        try {
            onCreated(await createToken({ expiresInDays: days, name: name.trim(), permissions }));
            onClose();
            reset();
        } catch {
            setError(translate("errors.token.saveFailed"));
        }

        setBusy(false);
    };

    const close = (): void => {
        reset();
        onClose();
    };

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    close();
                }
            }}
            open={open}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{translate("settings.tokenCreate")}</DialogTitle>
                    <DialogDescription>{translate("settings.tokenDescription")}</DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submit();
                    }}
                >
                    <div className="space-y-2">
                        <label className="block text-sm font-medium" htmlFor="token-name">
                            {translate("settings.tokenNameLabel")}
                        </label>
                        <Input
                            id="token-name"
                            maxLength={32}
                            onChange={(event) => {
                                setName(event.target.value);
                            }}
                            placeholder={translate("settings.tokenNamePlaceholder")}
                            required
                            value={name}
                        />
                    </div>
                    <TokenPermissionFields
                        onDeleteChange={setRemove}
                        onReadChange={setRead}
                        onWriteChange={setWrite}
                        readRequired={readRequired}
                        readSelected={readSelected}
                        remove={remove}
                        write={write}
                    />
                    <ExpiryField
                        customDays={customDays}
                        expiry={expiry}
                        onCustomDaysChange={setCustomDays}
                        onExpiryChange={setExpiry}
                    />
                    {error ? (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    ) : null}
                    <DialogFooter className="flex-row justify-end">
                        <Button onClick={close} type="button" variant="outline">
                            {translate("common.cancel")}
                        </Button>
                        <Button disabled={busy || name.trim() === "" || daysInvalid} type="submit">
                            {translate("settings.tokenCreate")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export { CreateTokenDialog };
