import { appManifest, parseTheme } from "./manifest";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { httpStatus } from "./lib/httpStatus";
import { themeCookieName } from "./lib/appTheme";

// The installed app's icon and splash follow the OS theme, so the manifest is built per request
// from the client hint. A request without the hint (such as a WebAPK update) uses the cookie the
// page sets, falling back to light.
const manifestApi = new Hono().get("/manifest.webmanifest", (context) => {
    const theme = parseTheme({
        cookie: getCookie(context, themeCookieName),
        hint: context.req.header("sec-ch-prefers-color-scheme")
    });

    context.header("cache-control", "no-cache");
    context.header("vary", "Sec-CH-Prefers-Color-Scheme, Cookie");

    return context.body(JSON.stringify(appManifest(theme)), httpStatus.ok, {
        "content-type": "application/manifest+json"
    });
});

export { manifestApi };
