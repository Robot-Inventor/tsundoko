// The share outcome is a set of counters: zero is where they start, one is their step.
// oxlint-disable no-magic-numbers
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { notifyError, notifyInfo, notifySuccess } from "../lib/appToast";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { LoaderCircleIcon } from "lucide-react";
import { requestBookmark } from "../lib/addBookmark";

interface ShareOutcome {
    added: number;
    duplicate: number;
    failed: number;
}

const summarize = ({ added, duplicate, failed }: ShareOutcome): string =>
    [
        added ? `${String(added)}件を追加しました。` : "",
        duplicate ? `${String(duplicate)}件は追加済みです。` : "",
        failed ? `${String(failed)}件は取得できませんでした。` : ""
    ]
        .filter(Boolean)
        .join("");

const reportOutcome = (outcome: ShareOutcome): void => {
    const summary = summarize(outcome);

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
    urls: string[];
}

// A share target launch adds without asking. A link from another site opens the same route but
// has a referrer, so the user confirms the URLs before anything is saved.
const ShareConfirmation = ({ onCancel, onConfirm, urls }: ShareConfirmationProps): ReactNode => (
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
                <DialogTitle>ブックマークを追加</DialogTitle>
                <DialogDescription>{String(urls.length)}件のブックマークを追加しますか？</DialogDescription>
            </DialogHeader>
            <ul className="max-h-60 space-y-1 overflow-y-auto">
                {urls.map((url) => (
                    <li className="wrap-anywhere" key={url}>
                        {url}
                    </li>
                ))}
            </ul>
            <DialogFooter className="flex-row justify-end">
                <Button onClick={onCancel} type="button" variant="outline">
                    キャンセル
                </Button>
                <Button onClick={onConfirm} type="button">
                    追加
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

const SharePage = (): ReactNode => {
    const { requiresConfirmation, urls } = useLoaderData({ from: "/share" });
    const navigate = useNavigate();
    const [confirmed, setConfirmed] = useState(!requiresConfirmation);
    const [done, setDone] = useState(0);
    const started = useRef(false);
    const answered = useRef(false);
    const waitsForConfirmation = requiresConfirmation && urls.length > 0 && !confirmed;

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

    // The run starts at most once per mount (the started ref guards re-entry), so overlapping
    // runs cannot write stale progress; the rule cannot trace the ref guard through the loop.
    // oxlint-disable-next-line react-doctor/no-set-state-after-await-in-effect
    useEffect(() => {
        if (started.current || waitsForConfirmation) {
            return;
        }

        started.current = true;

        if (!urls.length) {
            notifyError("共有されたテキストからURLが見つかりませんでした。");
            void navigate({ replace: true, to: "/" });

            return;
        }

        void (async (): Promise<void> => {
            const outcome: ShareOutcome = {
                added: 0,
                duplicate: 0,
                failed: 0
            };

            for (const [index, href] of urls.entries()) {
                // One request at a time keeps the progress count meaningful and the server load flat.
                // oxlint-disable-next-line no-await-in-loop react-doctor/async-await-in-loop
                const result = await requestBookmark(new URL(href));

                if ("bookmark" in result) {
                    outcome.added += 1;
                } else if (result.failure === "duplicate") {
                    outcome.duplicate += 1;
                } else {
                    outcome.failed += 1;
                }

                setDone(index + 1);
            }

            // The user may have left the share screen while the requests ran; do not pull them back.
            if (window.location.pathname === "/share") {
                await navigate({ replace: true, to: "/" });
            }

            reportOutcome(outcome);
        })();
    }, [navigate, urls, waitsForConfirmation]);

    if (waitsForConfirmation) {
        return <ShareConfirmation onCancel={cancel} onConfirm={confirm} urls={urls} />;
    }

    if (!urls.length) {
        return null;
    }

    return (
        <div className="flex flex-col items-center gap-3 py-24">
            <LoaderCircleIcon aria-hidden="true" className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground" role="status">
                追加しています…（{String(Math.min(done + 1, urls.length))}/{String(urls.length)}）
            </p>
        </div>
    );
};

export { SharePage };
