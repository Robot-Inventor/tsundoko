import { type ReactNode, useState } from "react";
import { isTagColor, tagColorPresets } from "../lib/tagColor";
import { Button } from "./ui/button";
import { HexColorPicker } from "react-colorful";
import { Input } from "./ui/Input";
import { cn } from "../lib/utils";
import { useTranslation } from "react-i18next";

const fallbackPickerColor = "#0091ff";
const hexInputId = "tag-color-hex";

interface TagColorFieldProps {
    color: string | null;
    disabled: boolean;
    onChange: (color: string | null) => void;
}

const TagColorField = ({ color, disabled, onChange }: TagColorFieldProps): ReactNode => {
    const [hexInput, setHexInput] = useState(color ?? "");
    const { t: translate } = useTranslation();
    const selectedColor = color?.toLowerCase() ?? null;

    const selectColor = (next: string | null): void => {
        if (disabled) {
            return;
        }

        setHexInput(next ?? "");
        onChange(next);
    };

    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{translate("tag.colorLabel")}</legend>
            <div className="flex flex-wrap items-center gap-2">
                {tagColorPresets.map((preset) => (
                    <button
                        aria-label={translate("tag.colorSwatch", { color: preset })}
                        aria-pressed={selectedColor === preset}
                        className={cn(
                            "size-7 rounded-full forced-color-adjust-none focus-visible:focus-outline",
                            selectedColor === preset && "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                        )}
                        disabled={disabled}
                        key={preset}
                        onClick={() => {
                            selectColor(preset);
                        }}
                        style={{ backgroundColor: preset }}
                        type="button"
                    />
                ))}
                <Button
                    aria-pressed={color === null}
                    disabled={disabled}
                    onClick={() => {
                        selectColor(null);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    {translate("tag.noColor")}
                </Button>
            </div>
            <HexColorPicker
                aria-label={translate("tag.colorLabel")}
                className={cn(disabled && "pointer-events-none opacity-50")}
                color={color ?? fallbackPickerColor}
                onChange={selectColor}
                style={{ height: "9rem", width: "100%" }}
            />
            <div className="space-y-1 pt-1">
                <label className="block text-sm font-medium" htmlFor={hexInputId}>
                    {translate("tag.hexLabel")}
                </label>
                <Input
                    className="font-mono"
                    id={hexInputId}
                    maxLength={7}
                    onBlur={() => {
                        if (!isTagColor(hexInput)) {
                            setHexInput(color ?? "");
                        }
                    }}
                    onChange={(event) => {
                        const value = event.currentTarget.value.trim();

                        setHexInput(value);

                        if (isTagColor(value)) {
                            onChange(value.toLowerCase());
                        }
                    }}
                    placeholder={fallbackPickerColor}
                    readOnly={disabled}
                    spellCheck={false}
                    value={hexInput}
                />
            </div>
        </fieldset>
    );
};

export { TagColorField };
