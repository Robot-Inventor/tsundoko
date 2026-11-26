import i18n, { use as registerPlugin } from "i18next";
import { detectLocale } from "./locale";
import en from "../locales/en.json";
import { initReactI18next } from "react-i18next";
import ja from "../locales/ja.json";

const resources = {
    en: {
        translation: en
    },
    ja: {
        translation: ja
    }
} as const;

registerPlugin(initReactI18next)
    .init({
        fallbackLng: "en",
        interpolation: {
            escapeValue: false
        },
        keySeparator: false,
        lng: detectLocale(),
        resources
    })
    .catch(() => null);

export { i18n, resources };
