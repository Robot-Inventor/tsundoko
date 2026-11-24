import type { Context } from "hono";
import { readFile } from "node:fs/promises";
import { serveStatic } from "@hono/bun";

// The SPA is served for every asset that exists; any other path is a client-side route.
const serveAppAssets = serveStatic({ root: "./dist" });

const serveAppHtml = async (context: Context): Promise<Response> =>
    context.newResponse(await readFile("dist/index.html"), {
        headers: {
            "cache-control": "no-store",
            "content-type": "text/html; charset=utf-8"
        }
    });

export { serveAppAssets, serveAppHtml };
