import { type Locale, saveLocale } from "../lib/locale";
import { type ReactNode, createContext, useContext, useState } from "react";
import { i18n } from "../lib/i18n";

interface LocaleContextValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const LocaleProvider = ({ children }: { children: ReactNode }): ReactNode => {
    const [locale, setLocaleState] = useState<Locale>(() => (i18n.language.startsWith("ja") ? "ja" : "en"));

    const setLocale = (next: Locale): void => {
        if (next === locale) {
            return;
        }

        setLocaleState(next);
        void i18n.changeLanguage(next);
        saveLocale(next);
    };

    return <LocaleContext value={{ locale, setLocale }}>{children}</LocaleContext>;
};

const useLocale = (): LocaleContextValue => {
    const value = useContext(LocaleContext);

    if (!value) {
        throw new Error("LocaleProvider is missing");
    }

    return value;
};

export { LocaleProvider, useLocale };
