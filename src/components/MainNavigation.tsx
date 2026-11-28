// oxlint-disable import/max-dependencies -- Navigation wires tags, colors, gestures, and translation.
import { ArchiveIcon, EllipsisVerticalIcon, HouseIcon, PencilIcon, TagIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { TagSummary } from "../lib/tags";
import { cn } from "../lib/utils";
import { readableTagColor } from "../lib/tagColor";
import { useLongPress } from "../hooks/useLongPress";
import { useTagListContext } from "../hooks/useTagList";
import { useTranslation } from "react-i18next";

const navLinkClass =
    "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold hover:bg-sidebar-accent focus-visible:focus-outline data-[status=active]:bg-foreground/10 dark:data-[status=active]:bg-foreground/20";

const homeActiveOptions = {
    exact: true
} as const;

interface TagNavItemProps {
    onEdit: () => void;
    onLongPress: () => void;
    onNavigate?: (() => void) | undefined;
    tag: TagSummary;
}

// Desktop reveals the menu on hover, while touch devices hold the row; both paths lead to the
// same editor. The trigger stays focusable so it also opens from the keyboard. The row highlight
// belongs to the wrapper: on the link it would vanish while the trigger, a sibling, is hovered.
const TagNavItem = ({ onEdit, onLongPress, onNavigate, tag }: TagNavItemProps): ReactNode => {
    const longPress = useLongPress(onLongPress);
    const { t: translate } = useTranslation();

    return (
        <div
            className="group/tag relative select-none rounded-lg hover:bg-sidebar-accent [-webkit-touch-callout:none]"
            {...longPress}
        >
            <Link className={cn(navLinkClass, "pe-10")} onClick={onNavigate} params={{ tag: tag.name }} to="/tags/$tag">
                <TagIcon
                    aria-hidden="true"
                    className="size-4 shrink-0"
                    style={{ color: readableTagColor(tag.color) }}
                />
                <span className="truncate">{tag.name}</span>
            </Link>
            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label={translate("tag.menuLabel", { name: tag.name })}
                    render=<Button
                        className="pointer-events-none absolute end-1 top-1/2 size-9 -translate-y-1/2 opacity-0 transition-opacity group-focus-within/tag:pointer-events-auto group-focus-within/tag:opacity-100 group-hover/tag:pointer-events-auto group-hover/tag:opacity-100 hover:bg-background focus-visible:pointer-events-auto focus-visible:opacity-100 aria-expanded:bg-background aria-expanded:pointer-events-auto aria-expanded:opacity-100 dark:hover:bg-background motion-reduce:transition-none"
                        size="icon-sm"
                        variant="ghost"
                    />
                >
                    <EllipsisVerticalIcon aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>
                        <PencilIcon aria-hidden="true" />
                        {translate("tag.edit")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};

interface MainNavigationProps {
    homeLinkRef?: React.Ref<HTMLAnchorElement>;
    onEditTag: (tag: TagSummary) => void;
    onLongPressTag: (tag: TagSummary) => void;
    onNavigate?: (() => void) | undefined;
}

const MainNavigation = ({ homeLinkRef, onEditTag, onLongPressTag, onNavigate }: MainNavigationProps): ReactNode => {
    const { tags } = useTagListContext();
    const { t: translate } = useTranslation();

    return (
        <nav aria-label={translate("common.mainNavigation")} className="space-y-1 px-3 py-2">
            <Link
                activeOptions={homeActiveOptions}
                className={navLinkClass}
                onClick={onNavigate}
                ref={homeLinkRef}
                to="/"
            >
                <HouseIcon aria-hidden="true" className="size-4" />
                {translate("common.home")}
            </Link>
            <Link className={navLinkClass} onClick={onNavigate} to="/archive">
                <ArchiveIcon aria-hidden="true" className="size-4" />
                {translate("common.archive")}
            </Link>
            {tags.length ? (
                <div className="mt-4 space-y-1">
                    <p className="px-3 text-xs font-semibold text-muted-foreground">{translate("common.tags")}</p>
                    {tags.map((tag) => (
                        <TagNavItem
                            key={tag.id}
                            onEdit={() => {
                                onEditTag(tag);
                            }}
                            onLongPress={() => {
                                onLongPressTag(tag);
                            }}
                            onNavigate={onNavigate}
                            tag={tag}
                        />
                    ))}
                </div>
            ) : null}
        </nav>
    );
};

export { MainNavigation };
