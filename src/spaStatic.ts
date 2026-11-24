import type { Context, MiddlewareHandler } from "hono";
import { isSharePath, needsShareConfirmation } from "./lib/shareTarget";
import { httpStatus } from "./lib/httpStatus";
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

// A link from another site opens the same route as a share target launch. A share launch is a
// browser-initiated navigation, so Sec-Fetch-Site is "none" and adds without asking; a cross-site
// navigation is redirected to the same URL with a marker the client turns into the confirmation
// dialog. Unlike a referrer, the browser sets this header and the page cannot suppress it. The
// marker also ends the redirect: Sec-Fetch-Site keeps its original value across redirects.
const serveShareGate: MiddlewareHandler = async (context, next) => {
    if (!isSharePath(context.req.path)) {
        await next();

        return;
    }

    const target = new URL(context.req.url);
    const marked = target.searchParams.get("confirm") === "1";

    if (!needsShareConfirmation(context.req.header("sec-fetch-site"), marked)) {
        return serveAppHtml(context);
    }

    target.searchParams.set("confirm", "1");

    // A relative Location keeps the browser on the public scheme and host behind the proxy.
    return context.redirect(`${target.pathname}${target.search}`, httpStatus.found);
};

export { serveAppAssets, serveAppHtml, serveShareGate };
