import { type AppTheme, themeCookieName } from "./appTheme";

// One year. The cookie only has to survive until Chrome's next manifest update check.
// oxlint-disable-next-line no-magic-numbers -- Seconds in a year are self-explanatory here.
const themeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

const currentTheme = (): AppTheme => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

// The manifest is served per theme. Chrome sends Sec-CH-Prefers-Color-Scheme with the
// manifest request, but a request without the hint falls back to this cookie, so the last
// theme the user actually saw still decides the installed app's splash and icon.
const syncThemeCookie = (): void => {
    document.cookie = `${themeCookieName}=${currentTheme()}; path=/; max-age=${String(themeCookieMaxAgeSeconds)}; samesite=lax`;
};

export { syncThemeCookie };
