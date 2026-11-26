import { appManifest, parseTheme } from "./manifest";
import { isLocale, localeCookieName } from "./lib/locale";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { httpStatus } from "./lib/httpStatus";
import { themeCookieName } from "./lib/appTheme";

// The installed app's icon, splash, and shortcut names follow the OS theme and the chosen locale,
// so the manifest is built per request from client hints and the cookies the page sets.
const manifestApi = new Hono().get("/manifest.webmanifest", (context) => {
    const theme = parseTheme({
        cookie: getCookie(context, themeCookieName),
        hint: context.req.header("sec-ch-prefers-color-scheme")
    });

    const cookieLocale = getCookie(context, localeCookieName);
    const locale = isLocale(cookieLocale) ? cookieLocale : "en";

    context.header("cache-control", "no-cache");
    context.header("vary", "Sec-CH-Prefers-Color-Scheme, Cookie");

    return context.body(JSON.stringify(appManifest(theme, locale)), httpStatus.ok, {
        "content-type": "application/manifest+json"
    });
});

export { manifestApi };
