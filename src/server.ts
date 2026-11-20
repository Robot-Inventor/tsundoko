import { Hono } from "hono";
import { bookmarkPreviewApi } from "./bookmarkPreview";
import { serveStatic } from "@hono/bun";

const app = new Hono();

app.get("/api/health", (context) => context.json({ ok: true }));
app.route("/", bookmarkPreviewApi);
app.get("*", serveStatic({ root: "./dist" }));

export default {
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port: 3000
};
