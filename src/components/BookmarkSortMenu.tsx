import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger
} from "./ui/dropdown-menu";
import { type SortBy, defaultSortBy, sortByValues } from "../lib/bookmarkSort";
import { ArrowDownUp } from "lucide-react";
import type { BookmarkScope } from "../lib/bookmark";
import { Button } from "./ui/button";
import type { ReactNode } from "react";
import { meClient } from "../lib/meClient";
import { notifyError } from "../lib/appToast";
import { useAccountContext } from "../hooks/useAccount";
import { useTranslation } from "react-i18next";

const sortLabels = {
    newest: "bookmark.sortNewest",
    oldest: "bookmark.sortOldest",
    titleAsc: "bookmark.sortTitleAsc",
    titleDesc: "bookmark.sortTitleDesc"
} as const satisfies Record<SortBy, string>;

interface BookmarkSortMenuProps {
    className?: string;
    scope: BookmarkScope;
}

const BookmarkSortMenu = ({ className, scope }: BookmarkSortMenuProps): ReactNode => {
    const { account, refresh } = useAccountContext();
    const { t: translate } = useTranslation();

    const sortBy =
        scope === "active" ? (account?.sortByActive ?? defaultSortBy) : (account?.sortByArchived ?? defaultSortBy);

    // Radio groups can emit null on clear; an unknown value must never be sent to the server.
    const change = (value: string | null): void => {
        const next = sortByValues.find((candidate) => candidate === value);

        if (!next || next === sortBy) {
            return;
        }

        const field = scope === "active" ? "sortByActive" : "sortByArchived";

        meClient.api.me
            .$patch({
                json: {
                    [field]: next
                }
            })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("sort save rejected");
                }

                refresh();
            })
            .catch(() => {
                notifyError(translate("errors.auth.sortSaveFailed"));
            });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={translate("bookmark.sortLabel")}
                render=<Button className={className} size="sm" variant="ghost" />
            >
                <ArrowDownUp aria-hidden="true" />
                <span className="hidden md:inline">{translate("bookmark.sortButton")}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-48 whitespace-nowrap">
                <DropdownMenuRadioGroup onValueChange={change} value={sortBy}>
                    {/* GroupLabel needs a RadioGroup parent; outside one Base UI throws. */}
                    <DropdownMenuLabel>{translate("bookmark.sortLabel")}</DropdownMenuLabel>
                    {sortByValues.map((value) => (
                        <DropdownMenuRadioItem closeOnClick key={value} value={value}>
                            {translate(sortLabels[value])}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export { BookmarkSortMenu };
