import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { TagSummary } from "../lib/tags";
import { onActionCommitted } from "../lib/bookmarkActions";
import { tagClient } from "../lib/tagClient";

interface TagListState {
    reload: () => void;
    tags: TagSummary[];
}

const useTagList = (pathname: string): TagListState => {
    const [tags, setTags] = useState<TagSummary[]>([]);

    const reload = useCallback((): void => {
        void (async (): Promise<void> => {
            try {
                const response = await tagClient.api.tags.$get();

                if (!response.ok) {
                    return;
                }

                const loaded = await response.json();

                setTags([...loaded].sort((left, right) => left.name.localeCompare(right.name)));
            } catch {
                setTags([]);
            }
        })();
    }, []);

    useEffect(() => {
        reload();
    }, [pathname, reload]);

    useEffect(
        () =>
            onActionCommitted((kind) => {
                if (kind === "delete") {
                    reload();
                }
            }),
        [reload]
    );

    return {
        reload,
        tags
    };
};

const TagListContext = createContext<TagListState | null>(null);

// Lives in AppLayout so the sidebar and the add dialog share one fetched list.
const useTagListContext = (): TagListState => {
    const context = useContext(TagListContext);

    if (!context) {
        throw new Error("useTagListContext requires the tag list context from AppLayout.");
    }

    return context;
};

export { TagListContext, useTagList, useTagListContext };
