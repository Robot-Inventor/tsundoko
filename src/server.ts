import { type AuthEnv, requireAuth } from "./authMiddleware";
import { serveAppAssets, serveAppHtml } from "./spaStatic";
import { Hono } from "hono";
import { apiPort } from "./apiPort";
import { auth } from "./lib/auth";
import { authApi } from "./authApi";
import { bookmarkApi } from "./bookmarkApi";
import { httpStatus } from "./lib/httpStatus";
import { imageApi } from "./imageApi";
import { meApi } from "./meApi";

const app = new Hono<AuthEnv>();

app.get("/api/health", (context) => context.json({ ok: true }));
app.route("/", authApi);
app.on(["POST", "GET"], "/api/auth/*", (context) => auth.handler(context.req.raw));

app.use("/api/bookmarks", requireAuth);
app.use("/api/bookmarks/*", requireAuth);
app.use("/api/me", requireAuth);
app.use("/api/thumbnail", requireAuth);
app.use("/api/favicon", requireAuth);
app.route("/", bookmarkApi);
app.route("/", imageApi);
app.route("/", meApi);

// Unknown API paths must not fall through to the SPA fallback below.
app.get("/api/*", (context) => context.json({ error: "Not found" }, httpStatus.notFound));

// The SPA is served for every asset that exists; any other path is a client-side route.
app.get("*", serveAppAssets);
app.get("*", serveAppHtml);

export default {
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port: apiPort
};
