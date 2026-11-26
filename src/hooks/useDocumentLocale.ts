import { getPage, getPageTitle } from "../lib/page-title";
import { useEffect } from "react";
import { useLocale } from "./useLocale";
import { useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

const useDocumentLocale = (): void => {
    const { pathname } = useLocation();
    const { locale } = useLocale();
    const { t: translate } = useTranslation();

    useEffect(() => {
        document.documentElement.lang = locale;
        document.title = getPageTitle(translate(getPage(pathname).label), translate);
    }, [locale, pathname, translate]);
};

export { useDocumentLocale };
