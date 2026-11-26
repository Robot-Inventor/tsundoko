import { type Locale, saveLocale } from "../lib/locale";
import { type ReactNode, useState } from "react";
import { LocaleContext } from "../hooks/useLocale";
import { i18n } from "../lib/i18n";

const LocaleProvider = ({ children }: { children: ReactNode }): ReactNode => {
    const [activeLocale, setActiveLocale] = useState<Locale>(() => (i18n.language.startsWith("ja") ? "ja" : "en"));

    const setLocale = (next: Locale): void => {
        if (next === activeLocale) {
            return;
        }

        setActiveLocale(next);
        void i18n.changeLanguage(next);
        saveLocale(next);
    };

    return <LocaleContext value={{ locale: activeLocale, setLocale }}>{children}</LocaleContext>;
};

export { LocaleProvider };
