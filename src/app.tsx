import { appToastManager, toastTimeoutMs } from "./lib/appToast";
import type { ReactNode } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "./components/ui/toast";
import { router } from "./router";

const App = (): ReactNode => (
    <>
        <RouterProvider router={router} />
        <Toaster timeout={toastTimeoutMs} toastManager={appToastManager} />
    </>
);

export { App };
