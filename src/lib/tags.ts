const maxTagLength = 30;
const maxTagsPerBookmark = 10;

interface TagSummary {
    count: number;
    name: string;
}

const trimTagName = (value: string): string => value.trim();

// Names keep the spelling the user first entered; only lookup and de-duplication use the lowercase key.
const tagNameKey = (value: string): string => trimTagName(value).toLowerCase();

// A null result means the input violated a limit; callers turn it into a validation error.
const normalizeTagNames = (values: string[]): string[] | null => {
    const names = values.map(trimTagName);

    if (names.length > maxTagsPerBookmark || names.some((name) => !name || name.length > maxTagLength)) {
        return null;
    }

    const seen = new Set<string>();

    return names.filter((name) => {
        const key = tagNameKey(name);

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;
    });
};

export { type TagSummary, maxTagLength, maxTagsPerBookmark, normalizeTagNames, tagNameKey, trimTagName };
