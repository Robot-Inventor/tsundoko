import { createContext, useContext } from "react";
import type { Locale } from "../lib/locale";

interface LocaleContextValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const useLocale = (): LocaleContextValue => {
    const value = useContext(LocaleContext);

    if (!value) {
        throw new Error("LocaleProvider is missing");
    }

    return value;
};

export { LocaleContext, useLocale };
