import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor
} from "./ui/combobox";
import { type ReactNode, useState } from "react";
import { maxTagLength, maxTagsPerBookmark, tagNameKey, trimTagName } from "../lib/tags";
import { useTranslation } from "react-i18next";

interface TagInputProps {
    disabled: boolean;
    onChange: (tags: string[]) => void;
    suggestions: string[];
    value: string[];
}

const TagInput = ({ disabled, onChange, suggestions, value }: TagInputProps): ReactNode => {
    const [input, setInput] = useState("");
    const [error, setError] = useState("");
    const anchor = useComboboxAnchor();
    const { t: translate } = useTranslation();
    const typed = trimTagName(input);

    // A typed name that only differs in case from an existing tag selects that tag instead of
    // creating a second spelling of it.
    const items =
        typed && !suggestions.some((name) => tagNameKey(name) === tagNameKey(typed))
            ? [...suggestions, typed]
            : suggestions;

    const changeTags = (next: string[]): void => {
        if (next.length > maxTagsPerBookmark) {
            setError(translate("errors.tag.tooMany"));

            return;
        }

        setError("");
        onChange(next);
    };

    return (
        <div className="space-y-1">
            <Combobox
                autoHighlight
                disabled={disabled}
                inputValue={input}
                items={items}
                multiple
                onInputValueChange={setInput}
                onValueChange={changeTags}
                value={value}
            >
                <ComboboxChips ref={anchor}>
                    <ComboboxValue>
                        {(values: string[]) => (
                            <>
                                {values.map((tag) => (
                                    <ComboboxChip className="bg-primary text-primary-foreground" key={tag}>
                                        {tag}
                                    </ComboboxChip>
                                ))}
                                <ComboboxChipsInput
                                    aria-label={translate("bookmark.tagsLabel")}
                                    maxLength={maxTagLength}
                                    placeholder={translate("bookmark.tagsPlaceholder")}
                                />
                            </>
                        )}
                    </ComboboxValue>
                </ComboboxChips>
                <ComboboxContent anchor={anchor}>
                    <ComboboxEmpty>{translate("bookmark.tagsEmpty")}</ComboboxEmpty>
                    <ComboboxList>
                        {(item: string) => (
                            <ComboboxItem key={item} value={item}>
                                {item}
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
            {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
};

export { TagInput };
