import { type AuthEnv, requireAuth } from "./authMiddleware";
import { serveAppAssets, serveAppHtml, serveShareGate } from "./spaStatic";
import { Hono } from "hono";
import { accountApi } from "./accountApi";
import { apiPort } from "./apiPort";
import { authApi } from "./authApi";
import { bookmarkApi } from "./bookmarkApi";
import { httpStatus } from "./lib/httpStatus";
import { imageApi } from "./imageApi";
import { manifestApi } from "./manifestApi";

const app = new Hono<AuthEnv>();

// Every response opts in to the color-scheme hint. The manifest is served per theme, and the
// manifest request that follows a document load only carries the hint after this opt-in.
app.use("*", async (context, next) => {
    await next();
    context.header("accept-ch", "Sec-CH-Prefers-Color-Scheme");
});

app.use("*", serveShareGate);

app.get("/api/health", (context) => context.json({ ok: true }));
app.route("/", manifestApi);
app.route("/", authApi);

app.use("/api/bookmarks", requireAuth);
app.use("/api/bookmarks/*", requireAuth);
app.use("/api/me", requireAuth);
app.use("/api/me/*", requireAuth);
app.use("/api/passkeys", requireAuth);
app.use("/api/passkeys/*", requireAuth);
app.use("/api/thumbnail", requireAuth);
app.use("/api/favicon", requireAuth);
app.route("/", bookmarkApi);
app.route("/", imageApi);
app.route("/", accountApi);

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
