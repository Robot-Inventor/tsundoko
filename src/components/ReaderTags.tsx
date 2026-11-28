import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { TagIcon } from "lucide-react";
import { readableTagColor } from "../lib/tagColor";
import { tagNameKey } from "../lib/tags";
import { useTagListContext } from "../hooks/useTagList";

interface ReaderTagsProps {
    tags: string[];
}

const ReaderTags = ({ tags }: ReaderTagsProps): ReactNode => {
    const { tags: tagList } = useTagListContext();

    if (!tags.length) {
        return null;
    }

    const colorByKey = new Map(tagList.map((tag) => [tagNameKey(tag.name), tag.color]));

    return (
        <ul className="flex flex-wrap gap-2 text-sm">
            {tags.map((tag) => (
                <li key={tag}>
                    <Link
                        className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:focus-outline"
                        params={{ tag }}
                        style={{ color: readableTagColor(colorByKey.get(tagNameKey(tag)) ?? null) }}
                        to="/tags/$tag"
                    >
                        <TagIcon aria-hidden="true" className="size-3.5 shrink-0" />
                        {tag}
                    </Link>
                </li>
            ))}
        </ul>
    );
};

export { ReaderTags };
