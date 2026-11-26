import type { Locale } from "./locale";

const xHandle = /^X (?<open>[（(])@(?<handle>[^)）]+)[)）]$/u;

// Bookmarks saved before English support carry full-width parentheses. Normalize either stored
// form to the form the current locale expects.
const formatSiteName = (siteName: string, locale: Locale): string => {
    const matched = xHandle.exec(siteName);
    const handle = matched?.groups?.["handle"];

    if (!handle) {
        return siteName;
    }

    return locale === "ja" ? `X（@${handle}）` : `X (@${handle})`;
};

const formatPasskeyName = (name: string, locale: Locale, japaneseFallback: string): string =>
    locale === "ja" && name === "Passkey" ? japaneseFallback : name;

export { formatPasskeyName, formatSiteName };
