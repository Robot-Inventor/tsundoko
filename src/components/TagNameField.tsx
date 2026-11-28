import type { ReactNode, RefObject } from "react";
import { Input } from "./ui/Input";
import { useTranslation } from "react-i18next";

// A tag is not an identity field. Keeping "name" out of the input's id and name avoids the
// heuristics password managers use to offer identity and login fills.
const nameInputId = "tag-label";

interface TagNameFieldProps {
    describedBy: string;
    disabled: boolean;
    invalid: boolean;
    name: string;
    nameInput: RefObject<HTMLInputElement | null>;
    onChange: (name: string) => void;
}

const TagNameField = ({ describedBy, disabled, invalid, name, nameInput, onChange }: TagNameFieldProps): ReactNode => {
    const { t: translate } = useTranslation();

    return (
        <div className="space-y-1">
            <label className="block text-sm font-medium" htmlFor={nameInputId}>
                {translate("tag.nameLabel")}
            </label>
            <Input
                aria-describedby={describedBy}
                aria-invalid={invalid}
                autoComplete="off"
                data-1p-ignore="true"
                id={nameInputId}
                name={nameInputId}
                onChange={(event) => {
                    onChange(event.currentTarget.value);
                }}
                readOnly={disabled}
                ref={nameInput}
                required
                value={name}
            />
        </div>
    );
};

export { TagNameField };
