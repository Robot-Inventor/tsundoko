import { Hono } from "hono";
import { bookmarkApi } from "./bookmarkApi";
import { serveStatic } from "@hono/bun";
import { thumbnailApi } from "./thumbnailApi";

const app = new Hono();

app.get("/api/health", (context) => context.json({ ok: true }));
app.route("/", bookmarkApi);
app.route("/", thumbnailApi);
app.get("*", serveStatic({ root: "./dist" }));

export default {
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port: 3000
};
