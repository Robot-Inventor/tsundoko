// oxlint-disable import/max-dependencies -- This file is the composition root that wires every API module together.
import { type AuthEnv, requireAuth } from "./authMiddleware";
import { serveAppAssets, serveAppHtml, serveShareGate } from "./spaStatic";
import { Hono } from "hono";
import { accountApi } from "./accountApi";
import { apiError } from "./lib/apiError";
import { apiPort } from "./apiPort";
import { authApi } from "./authApi";
import { bookmarkApi } from "./bookmarkApi";
import { httpStatus } from "./lib/httpStatus";
import { imageApi } from "./imageApi";
import { manifestApi } from "./manifestApi";
import { mcpApi } from "./mcpApi";
import { responseHeaders } from "./responseHeaders";
import { tagApi } from "./tagApi";
import { tokenApi } from "./tokenApi";

const isProduction = process.env["NODE_ENV"] === "production";

// A container deployment opens the port as soon as the process starts, so pending migrations are
// applied first and a failure keeps the server from serving against an outdated schema. Development
// applies them with `bun run migrate:apply` instead.
if (isProduction) {
    const { runMigrations } = await import("./db/migrate");

    await runMigrations();
}

const app = new Hono<AuthEnv>();

app.use("*", responseHeaders);

app.use("*", serveShareGate);

app.get("/api/health", (context) => context.json({ ok: true }));
app.route("/", manifestApi);
app.route("/", authApi);

app.use("/api/bookmarks", requireAuth);
app.use("/api/bookmarks/*", requireAuth);
app.use("/api/tags", requireAuth);
app.use("/api/tags/*", requireAuth);
app.use("/api/me", requireAuth);
app.use("/api/me/*", requireAuth);
app.use("/api/passkeys", requireAuth);
app.use("/api/passkeys/*", requireAuth);
app.use("/api/tokens", requireAuth);
app.use("/api/tokens/*", requireAuth);
app.use("/api/thumbnail", requireAuth);
app.use("/api/favicon", requireAuth);
app.route("/", bookmarkApi);
app.route("/", tagApi);
app.route("/", tokenApi);
app.route("/", imageApi);
app.route("/", accountApi);
// The MCP endpoint authenticates its own bearer token, so it does not use the cookie session above.
app.route("/", mcpApi);

// Unknown API paths must not fall through to the SPA fallback below.
app.get("/api/*", (context) => context.json(apiError("notFound"), httpStatus.notFound));

// The SPA is served for every asset that exists; any other path is a client-side route.
app.get("*", serveAppAssets);
app.get("*", serveAppHtml);

// A container needs every interface for the platform's proxy to reach the port. Local development
// stays on the loopback so the API is not exposed to the local network.
export default {
    fetch: app.fetch,
    hostname: isProduction ? "0.0.0.0" : "127.0.0.1",
    port: apiPort
};
