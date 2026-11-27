// JSON-LD scripts are parsed by open-graph-scraper into raw objects. It has no traversal helper,
// so this walks arrays, @graph, and nested objects to find a schema.org publication date.
const datePublishedKeys = [
    "datePublished",
    "https://schema.org/datePublished",
    "http://schema.org/datePublished"
] as const;

// JSON.parse produces acyclic data, but a depth cap keeps a reused helper from recursing forever.
const maxDepth = 32;
const rootDepth = 0;
const childDepthStep = 1;

const dateValue = (value: unknown): string | null => {
    if (typeof value === "string") {
        return value.trim() || null;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? String(value) : null;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = dateValue(item);

            if (found) {
                return found;
            }
        }

        return null;
    }

    if (value && typeof value === "object") {
        // Expanded JSON-LD wraps scalar values as { "@value": "..." }.
        for (const [key, child] of Object.entries(value)) {
            if (key === "@value") {
                return dateValue(child);
            }
        }
    }

    return null;
};

const findOnNode = (entries: Array<[string, unknown]>): string | null => {
    // Prefer a date on this node before looking deeper, so the shallowest match wins.
    for (const [key, child] of entries) {
        if (datePublishedKeys.some((candidate) => candidate === key)) {
            const found = dateValue(child);

            if (found) {
                return found;
            }
        }
    }

    return null;
};

const findDate = (value: unknown, depth: number): string | null => {
    if (depth > maxDepth) {
        return null;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findDate(item, depth + childDepthStep);

            if (found) {
                return found;
            }
        }

        return null;
    }

    if (!value || typeof value !== "object") {
        return null;
    }

    const entries = Object.entries(value);
    const ownDate = findOnNode(entries);

    if (ownDate) {
        return ownDate;
    }

    for (const [, child] of entries) {
        const found = findDate(child, depth + childDepthStep);

        if (found) {
            return found;
        }
    }

    return null;
};

const jsonLdDatePublished = (jsonLD?: object[]): string | null => findDate(jsonLD, rootDepth);

export { jsonLdDatePublished };
