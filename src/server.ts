import { Hono } from "hono";
import { apiPort } from "./apiPort";
import { bookmarkApi } from "./bookmarkApi";
import { imageApi } from "./imageApi";
import { readFile } from "node:fs/promises";
import { serveStatic } from "@hono/bun";

const httpStatus = {
    internalServerError: 500,
    notFound: 404
} as const;

const app = new Hono();

app.get("/api/health", (context) => context.json({ ok: true }));
app.route("/", bookmarkApi);
app.route("/", imageApi);

// Unknown API paths must not fall through to the SPA fallback below.
app.get("/api/*", (context) => context.json({ error: "Not found" }, httpStatus.notFound));

// The SPA is served for every asset that exists; any other path is a client-side route.
app.get("*", serveStatic({ root: "./dist" }));
app.get("*", async (context) =>
    context.newResponse(await readFile("dist/index.html"), {
        headers: {
            "cache-control": "no-store",
            "content-type": "text/html; charset=utf-8"
        }
    })
);

export default {
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port: apiPort
};
