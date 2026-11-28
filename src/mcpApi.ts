import type { AuthInfo } from "@modelcontextprotocol/server";
import { Hono } from "hono";
import { authenticateMcpToken } from "./mcp/tokenAuth";
import { env } from "./env";
import { httpStatus } from "./lib/httpStatus";
import { mcpHandler } from "./mcp/server";
import { permissionsToScopes } from "./lib/tokenPermissions";

// The endpoint is public on the VPS. Host validation is cheap and keeps a DNS-rebound browser
// request from reaching the token check with the deployment's own hostname.
const allowedHost = new URL(env.BETTER_AUTH_URL).host;

const mcpApi = new Hono().all("/api/mcp", async (context) => {
    const request = context.req.raw;

    context.header("Cache-Control", "no-store");

    if (request.headers.get("host")?.toLowerCase() !== allowedHost) {
        return context.text("Forbidden", httpStatus.forbidden);
    }

    const outcome = await authenticateMcpToken(request);

    if (outcome.status === "rateLimited") {
        context.header("Retry-After", String(outcome.retryAfterSeconds));

        return context.json({ error: "rateLimited" }, httpStatus.tooManyRequests);
    }

    if (outcome.status === "unauthorized") {
        context.header("WWW-Authenticate", "Bearer");

        return context.json({ error: "unauthorized" }, httpStatus.unauthorized);
    }

    // The endpoint is the only producer of AuthInfo, so clientId carries the bookmark owner here.
    const authInfo: AuthInfo = {
        clientId: outcome.identity.userId,
        scopes: permissionsToScopes(outcome.identity.permissions),
        token: outcome.identity.token
    };

    const response = await mcpHandler.fetch(request, { authInfo });
    // A raw Response bypasses Hono's prepared headers, so set this on the response itself.
    response.headers.set("Cache-Control", "no-store");

    return response;
});

export { mcpApi };
