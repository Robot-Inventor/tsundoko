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
import { tagChipStyle } from "../lib/tagColor";
import { useTagListContext } from "../hooks/useTagList";
import { useTranslation } from "react-i18next";

interface TagInputProps {
    disabled: boolean;
    onChange: (tags: string[]) => void;
    suggestions: string[];
    value: string[];
}

interface TagChipProps {
    color: string | null;
    name: string;
}

// The registry chip owns its text styles, so the colored variant is a separate branch instead of
// an inline style that would also apply when the tag has no color.
const TagChip = ({ color, name }: TagChipProps): ReactNode => {
    if (!color) {
        return <ComboboxChip className="bg-primary text-primary-foreground">{name}</ComboboxChip>;
    }

    return (
        <ComboboxChip className="tag-color-chip" style={tagChipStyle(color)}>
            {name}
        </ComboboxChip>
    );
};

const TagInput = ({ disabled, onChange, suggestions, value }: TagInputProps): ReactNode => {
    const [input, setInput] = useState("");
    const [error, setError] = useState("");
    const anchor = useComboboxAnchor();
    const { tags } = useTagListContext();
    const { t: translate } = useTranslation();
    const typed = trimTagName(input);
    const colorByKey = new Map(tags.map((tag) => [tagNameKey(tag.name), tag.color]));

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
                                    <TagChip color={colorByKey.get(tagNameKey(tag)) ?? null} key={tag} name={tag} />
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
