import { appToastManager, toastTimeoutMs } from "./lib/appToast";
import { LocaleProvider } from "./components/LocaleProvider";
import type { ReactNode } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "./components/ui/toast";
import { router } from "./router";

const App = (): ReactNode => (
    <LocaleProvider>
        <RouterProvider router={router} />
        <Toaster timeout={toastTimeoutMs} toastManager={appToastManager} />
    </LocaleProvider>
);

export { App };
