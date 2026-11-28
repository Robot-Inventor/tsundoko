import { type } from "arktype";

const tokenActions = ["read", "write", "delete"] as const;

const tokenPermissionLabelKeys = {
    delete: "settings.tokenPermissionDelete",
    read: "settings.tokenPermissionRead",
    write: "settings.tokenPermissionWrite"
} as const;

type TokenAction = (typeof tokenActions)[number];

interface TokenPermissions {
    bookmarks: TokenAction[];
}

const tokenPermissions = type({
    bookmarks: type.enumerated(...tokenActions).array()
});

// Write and delete only make sense when the token can also inspect what it changes, so read is
// always present in a non-empty permission set.
const normalizeTokenPermissions = (actions: TokenAction[]): TokenPermissions => {
    const selected = new Set(actions);

    if (selected.size) {
        selected.add("read");
    }

    return {
        bookmarks: tokenActions.filter((action) => selected.has(action))
    };
};

const mcpScope = (action: TokenAction): string => `bookmarks:${action}`;

const permissionsToScopes = (permissions: TokenPermissions): string[] =>
    permissions.bookmarks.map((action) => mcpScope(action));

const scopesToPermissions = (scopes: string[]): TokenPermissions =>
    normalizeTokenPermissions(tokenActions.filter((action) => scopes.includes(mcpScope(action))));

// A stored key may predate the current action list or contain a hand-edited value; an unreadable
// set grants no access instead of failing the whole MCP request.
const parseTokenPermissions = (value: unknown): TokenPermissions => {
    const parsed = tokenPermissions(value);

    return parsed instanceof type.errors
        ? {
              bookmarks: []
          }
        : normalizeTokenPermissions(parsed.bookmarks);
};

const parseStoredTokenPermissions = (value: string | null): TokenPermissions => {
    if (value === null) {
        return {
            bookmarks: []
        };
    }

    try {
        return parseTokenPermissions(JSON.parse(value));
    } catch {
        return {
            bookmarks: []
        };
    }
};

const hasTokenPermission = (permissions: TokenPermissions, action: TokenAction): boolean =>
    permissions.bookmarks.includes(action);

export {
    type TokenAction,
    type TokenPermissions,
    hasTokenPermission,
    normalizeTokenPermissions,
    parseStoredTokenPermissions,
    parseTokenPermissions,
    permissionsToScopes,
    scopesToPermissions,
    tokenPermissionLabelKeys,
    tokenPermissions
};
