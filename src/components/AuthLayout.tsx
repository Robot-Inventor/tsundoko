import { HeadContent, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";

const AuthLayout = (): ReactNode => (
    <>
        <HeadContent />
        <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
            <div className="w-full max-w-sm space-y-6">
                <img alt="Tsundoko" className="mx-auto h-auto w-40" height={370} src="/logo.svg" width={1666} />
                <Outlet />
            </div>
        </div>
    </>
);

export { AuthLayout };
