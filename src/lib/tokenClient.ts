import { type TokenPermissions, tokenPermissions } from "./tokenPermissions";
import { type } from "arktype";

const noContent = 204;

const apiToken = type({
    createdAt: "string",
    expiresAt: "string | null",
    id: "string",
    lastRequest: "string | null",
    name: "string | null",
    permissions: tokenPermissions,
    start: "string | null"
});

const apiTokenList = apiToken.array();

const createdApiToken = apiToken.and({ token: "string" });

type ApiToken = typeof apiToken.infer;

type CreatedApiToken = typeof createdApiToken.infer;

interface CreateTokenRequest {
    expiresInDays: number | null;
    name: string;
    permissions: TokenPermissions;
}

const request = async (input: string, init?: RequestInit): Promise<unknown> => {
    const response = await fetch(input, init);

    if (!response.ok) {
        throw new Error("Token request failed.");
    }

    return response.status === noContent ? null : response.json();
};

const listTokens = async (): Promise<ApiToken[]> => {
    const parsed = apiTokenList(await request("/api/tokens"));

    if (parsed instanceof type.errors) {
        throw new Error("Invalid token list.");
    }

    return parsed;
};

const createToken = async ({ expiresInDays, name, permissions }: CreateTokenRequest): Promise<CreatedApiToken> => {
    const parsed = createdApiToken(
        await request("/api/tokens", {
            body: JSON.stringify({ expiresInDays, name, permissions }),
            headers: {
                "content-type": "application/json"
            },
            method: "POST"
        })
    );

    if (parsed instanceof type.errors) {
        throw new Error("Invalid token response.");
    }

    return parsed;
};

const deleteToken = async (id: string): Promise<void> => {
    await request(`/api/tokens/${encodeURIComponent(id)}`, { method: "DELETE" });
};

export { type ApiToken, type CreatedApiToken, type TokenPermissions, createToken, deleteToken, listTokens };
