import type { Locale } from "./locale";

const formatters = {
    en: new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }),
    ja: new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" })
} as const satisfies Record<Locale, Intl.DateTimeFormat>;

const formatDate = (locale: Locale, isoDate: string | null, emptyLabel: string): string =>
    isoDate ? formatters[locale].format(new Date(isoDate)) : emptyLabel;

export { formatDate };
