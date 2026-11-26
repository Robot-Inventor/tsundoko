// oxlint-disable id-length -- "q" is the search parameter name defined by the URL.
// Search params come from the URL, so values other than a single string are discarded.
const parseSearchQuery = (search: Record<string, unknown>): { q?: string } => {
    const raw = search["q"];
    const trimmed = typeof raw === "string" ? raw.trim() : "";

    if (!trimmed) {
        return {};
    }

    return {
        q: trimmed
    };
};

export { parseSearchQuery };
