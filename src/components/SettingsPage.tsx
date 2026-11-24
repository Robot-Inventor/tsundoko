import type { ReactNode } from "react";
import { pages } from "../lib/page-title";

const SettingsPage = (): ReactNode => (
    <>
        {/* The mobile header carries the page title, so the in-page h1 shows on desktop only. */}
        <h1 className="hidden text-xl font-semibold md:block">{pages["/settings"].label}</h1>
        <p className="mt-4 text-muted-foreground">設定は準備中です。</p>
    </>
);

export { SettingsPage };
