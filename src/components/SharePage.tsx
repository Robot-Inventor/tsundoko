// oxlint-disable import/max-dependencies -- The share page wires the confirmation form and the add loop.
// The share outcome is a set of counters: zero is where they start, one is their step.
// oxlint-disable no-magic-numbers
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { notifyError, notifyInfo, notifySuccess } from "../lib/appToast";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { LoaderCircleIcon } from "lucide-react";
import type { TFunction } from "i18next";
import { TagInput } from "./TagInput";
import { requestBookmark } from "../lib/addBookmark";
import { useLoginRedirect } from "../hooks/useLoginRedirect";
import { useTagListContext } from "../hooks/useTagList";
import { useTranslation } from "react-i18next";

interface ShareOutcome {
    added: number;
    duplicate: number;
    failed: number;
}

const summarize = (outcome: ShareOutcome, translate: TFunction, separator: string): string =>
    [
        outcome.added ? translate("share.summaryAdded", { count: outcome.added }) : "",
        outcome.duplicate ? translate("share.summaryDuplicate", { count: outcome.duplicate }) : "",
        outcome.failed ? translate("share.summaryFailed", { count: outcome.failed }) : ""
    ]
        .filter(Boolean)
        .join(separator);

const reportOutcome = (outcome: ShareOutcome, translate: TFunction, separator: string): void => {
    const summary = summarize(outcome, translate, separator);

    if (outcome.failed) {
        notifyError(summary);
    } else if (outcome.duplicate && !outcome.added) {
        notifyInfo(summary);
    } else {
        notifySuccess(summary);
    }
};

interface ShareConfirmationProps {
    onCancel: () => void;
    onConfirm: () => void;
    onTagNamesChange: (tags: string[]) => void;
    tagNames: string[];
    urls: string[];
}

// A browser-initiated share launch adds without asking. Other navigations get a confirmation
// marker from the server (Sec-Fetch-Site, or its absence), so the user confirms the URLs first.
const ShareConfirmation = ({
    onCancel,
    onConfirm,
    onTagNamesChange,
    tagNames,
    urls
}: ShareConfirmationProps): ReactNode => {
    const { tags } = useTagListContext();
    const { t: translate } = useTranslation();

    return (
        <Dialog
            onOpenChange={(open) => {
                if (!open) {
                    onCancel();
                }
            }}
            open
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{translate("share.confirmTitle")}</DialogTitle>
                    <DialogDescription>
                        {translate("share.confirmDescription", { count: urls.length })}
                    </DialogDescription>
                </DialogHeader>
                <ul className="max-h-60 space-y-1 overflow-y-auto">
                    {urls.map((url) => (
                        <li className="wrap-anywhere" key={url}>
                            {url}
                        </li>
                    ))}
                </ul>
                <div className="space-y-1">
                    <p className="text-sm font-medium">{translate("bookmark.tagsLabel")}</p>
                    <TagInput
                        disabled={false}
                        onChange={onTagNamesChange}
                        suggestions={tags.map((tag) => tag.name)}
                        value={tagNames}
                    />
                </div>
                <DialogFooter className="flex-row justify-end">
                    <Button onClick={onCancel} type="button" variant="outline">
                        {translate("common.cancel")}
                    </Button>
                    <Button onClick={onConfirm} type="button">
                        {translate("common.add")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

interface AddShareUrlsInput {
    onDone: (count: number) => void;
    redirectToLogin: () => void;
    tagNames: string[];
    urls: string[];
}

// A 401 ends the run: the share route starts over after sign-in with the same URLs.
const addShareUrls = async ({
    onDone,
    redirectToLogin,
    tagNames,
    urls
}: AddShareUrlsInput): Promise<ShareOutcome | null> => {
    const outcome: ShareOutcome = {
        added: 0,
        duplicate: 0,
        failed: 0
    };

    for (const [index, href] of urls.entries()) {
        // One request at a time keeps the progress count meaningful and the server load flat.
        // oxlint-disable-next-line no-await-in-loop
        const result = await requestBookmark(new URL(href), tagNames);

        if ("bookmark" in result) {
            outcome.added += 1;
        } else if (result.failure === "auth") {
            redirectToLogin();

            return null;
        } else if (result.failure === "duplicate") {
            outcome.duplicate += 1;
        } else {
            outcome.failed += 1;
        }

        onDone(index + 1);
    }

    return outcome;
};

const SharePage = (): ReactNode => {
    const { requiresConfirmation, urls } = useLoaderData({ from: "/share" });
    const navigate = useNavigate();
    const redirectToLogin = useLoginRedirect();
    const [confirmed, setConfirmed] = useState(!requiresConfirmation);
    const [done, setDone] = useState(0);
    const [tagNames, setTagNames] = useState<string[]>([]);
    const started = useRef(false);
    const answered = useRef(false);
    const waitsForConfirmation = requiresConfirmation && urls.length > 0 && !confirmed;
    const { t: translate } = useTranslation();
    const separator = translate("common.summarySeparator");

    const cancel = (): void => {
        if (answered.current) {
            return;
        }

        answered.current = true;
        void navigate({ replace: true, to: "/" });
    };

    const confirm = (): void => {
        answered.current = true;
        setConfirmed(true);
    };

    // The run starts at most once per mount, so overlapping runs cannot write stale progress.
    useEffect(() => {
        if (started.current || waitsForConfirmation) {
            return;
        }

        started.current = true;

        if (!urls.length) {
            notifyError(translate("share.noUrls"));
            void navigate({ replace: true, to: "/" });

            return;
        }

        void (async (): Promise<void> => {
            const outcome = await addShareUrls({
                onDone: setDone,
                redirectToLogin,
                tagNames,
                urls
            });

            if (!outcome) {
                return;
            }

            // The user may have left the share screen while the requests ran; do not pull them back.
            if (window.location.pathname === "/share") {
                await navigate({ replace: true, to: "/" });
            }

            reportOutcome(outcome, translate, separator);
        })();
    }, [navigate, redirectToLogin, separator, tagNames, translate, urls, waitsForConfirmation]);

    if (waitsForConfirmation) {
        return (
            <ShareConfirmation
                onCancel={cancel}
                onConfirm={confirm}
                onTagNamesChange={setTagNames}
                tagNames={tagNames}
                urls={urls}
            />
        );
    }

    if (!urls.length) {
        return null;
    }

    return (
        <div className="flex flex-col items-center gap-3 py-24">
            <LoaderCircleIcon aria-hidden="true" className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground" role="status">
                {translate("share.adding", { current: Math.min(done + 1, urls.length), total: urls.length })}
            </p>
        </div>
    );
};

export { SharePage };
