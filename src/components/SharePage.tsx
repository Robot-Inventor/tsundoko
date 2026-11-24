// The share outcome is a set of counters: zero is where they start, one is their step.
// oxlint-disable no-magic-numbers
import { type ReactNode, useEffect, useRef, useState } from "react";
import { notifyError, notifyInfo, notifySuccess } from "../lib/appToast";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
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

const SharePage = (): ReactNode => {
    const urls = useLoaderData({ from: "/share" });
    const navigate = useNavigate();
    const [done, setDone] = useState(0);
    const started = useRef(false);

    useEffect(() => {
        if (started.current) {
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
                // oxlint-disable-next-line no-await-in-loop
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
    }, [navigate, urls]);

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
