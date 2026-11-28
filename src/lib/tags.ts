import { isTagColor } from "./tagColor";

const maxTagLength = 30;
const maxTagsPerBookmark = 10;

interface TagSummary {
    color: string | null;
    count: number;
    id: string;
    name: string;
}

const trimTagName = (value: string): string => value.trim();

// A null color is valid and clears the tag's color; anything else must be a hex value.
const isValidTagColor = (color: string | null): boolean => color === null || isTagColor(color);

// Names keep the spelling the user first entered; only lookup and de-duplication use the lowercase key.
const tagNameKey = (value: string): string => trimTagName(value).toLowerCase();

// A null result means the input violated a limit; callers turn it into a validation error.
const normalizeTagNames = (values: string[]): string[] | null => {
    const names = values.map(trimTagName);

    if (names.some((name) => !name || name.length > maxTagLength)) {
        return null;
    }

    const seen = new Set<string>();

    const uniqueNames = names.filter((name) => {
        const key = tagNameKey(name);

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;
    });

    return uniqueNames.length > maxTagsPerBookmark ? null : uniqueNames;
};

export {
    type TagSummary,
    isValidTagColor,
    maxTagLength,
    maxTagsPerBookmark,
    normalizeTagNames,
    tagNameKey,
    trimTagName
};
