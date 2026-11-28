import "@pierre/words/styles.css";
import { ExternalLinkIcon } from "lucide-react";
import { Markdown } from "@pierre/words/react";
import type { ReactNode } from "react";
import { ReaderTags } from "./ReaderTags";
import { buttonVariants } from "./ui/button";
import { formatDate } from "../lib/dateFormat";
import { useLoaderData } from "@tanstack/react-router";
import { useLocale } from "../hooks/useLocale";
import { useTranslation } from "react-i18next";

// Words writes HTML directly, so article links need the same tab policy as the bookmark card.
const openInNewTab = (html: string): string => html.replace("<a ", '<a rel="noopener noreferrer" target="_blank" ');
// Words names its HTML hooks after tag names, so the one-letter key is part of its API.
const markdownComponents = {
    // oxlint-disable-next-line id-length
    a: openInNewTab
} as const;

const ReaderPage = (): ReactNode => {
    const bookmark = useLoaderData({ from: "/reader/$bookmarkId" });
    const { locale } = useLocale();
    const { t: translate } = useTranslation();

    if (!bookmark) {
        return <p className="text-muted-foreground">{translate("reader.notFound")}</p>;
    }

    return (
        <article className="mx-auto max-w-3xl space-y-6">
            <div className="space-y-3">
                {/* Desktop puts the original-link button above the title; mobile uses the header icon. */}
                <div className="hidden justify-end md:flex">
                    <a className={buttonVariants()} href={bookmark.url} rel="noopener noreferrer" target="_blank">
                        <ExternalLinkIcon aria-hidden="true" />
                        {translate("bookmark.actionOpenOriginal")}
                        <span className="sr-only">{translate("common.opensInNewTab")}</span>
                    </a>
                </div>

                <h1 className="text-2xl font-semibold wrap-anywhere">{bookmark.title}</h1>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {bookmark.publishedAt ? (
                        <span>
                            {translate("reader.publishedAt", {
                                date: formatDate(locale, bookmark.publishedAt, translate("common.unknownDate"))
                            })}
                        </span>
                    ) : null}
                    <span>
                        {translate("reader.addedAt", {
                            date: formatDate(locale, bookmark.addedAt, translate("common.unknownDate"))
                        })}
                    </span>
                </div>
            </div>

            <ReaderTags tags={bookmark.tags} />

            {bookmark.content ? (
                <Markdown components={markdownComponents} mode="static">
                    {bookmark.content}
                </Markdown>
            ) : (
                <p className="text-muted-foreground">{translate("reader.noContent")}</p>
            )}
        </article>
    );
};

export { ReaderPage };
