import { type TokenPermissions, parseTokenPermissions } from "../lib/tokenPermissions";
import { auth } from "../lib/auth";
import { mcpTokenLimiter } from "../lib/rateLimits";

interface McpTokenIdentity {
    permissions: TokenPermissions;
    token: string;
    userId: string;
}

type McpAuthOutcome =
    | {
          identity: McpTokenIdentity;
          status: "authenticated";
      }
    | {
          retryAfterSeconds: number;
          status: "rateLimited";
      }
    | {
          status: "unauthorized";
      };

// MCP clients pass the personal access token as a bearer token. Better Auth hashes the presented
// value and also applies the token's own rate limit before the tools run.
const authenticateMcpToken = async (request: Request): Promise<McpAuthOutcome> => {
    const match = /^Bearer\s+(?<token>\S+)$/iu.exec(request.headers.get("authorization") ?? "");
    const token = match?.groups?.["token"];

    if (!token) {
        return {
            status: "unauthorized"
        };
    }

    const result = await auth.api.verifyApiKey({
        body: {
            key: token
        }
    });

    if (result.valid && result.key) {
        const limited = await mcpTokenLimiter(result.key.id);

        if (!limited.allowed) {
            return {
                retryAfterSeconds: limited.retryAfterSeconds,
                status: "rateLimited"
            };
        }

        return {
            identity: {
                permissions: parseTokenPermissions(result.key.permissions),
                token,
                userId: result.key.referenceId
            },
            status: "authenticated"
        };
    }

    return {
        status: "unauthorized"
    };
};

export { type McpAuthOutcome, authenticateMcpToken };
