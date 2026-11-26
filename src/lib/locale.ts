type Locale = "ja" | "en";

const localeCookieName = "locale";
const localeStorageKey = "locale";

// One year, matching the theme cookie: the manifest is served per locale and WebAPK updates
// can reach the server without a page load.
// oxlint-disable-next-line no-magic-numbers -- Seconds in a year are self-explanatory here.
const localeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

const isLocale = (value: unknown): value is Locale => value === "ja" || value === "en";

// A saved choice wins. Otherwise Japanese is used only when the browser explicitly prefers it;
// every other language starts in English.
const detectLocale = (): Locale => {
    if (typeof window === "undefined") {
        return "en";
    }

    try {
        const saved = window.localStorage.getItem(localeStorageKey);

        if (isLocale(saved)) {
            return saved;
        }
    } catch {
        // Private browsing may block storage; fall through to the browser language.
    }

    const preferred = navigator.languages[0] ?? navigator.language;

    return preferred.toLowerCase().startsWith("ja") ? "ja" : "en";
};

const saveLocale = (locale: Locale): void => {
    try {
        window.localStorage.setItem(localeStorageKey, locale);
    } catch {
        // The cookie below still keeps the manifest in sync when storage is unavailable.
    }

    document.cookie = `${localeCookieName}=${locale}; path=/; max-age=${String(localeCookieMaxAgeSeconds)}; samesite=lax`;
};

export { type Locale, detectLocale, isLocale, localeCookieName, saveLocale };
