import { AppLayout } from "./AppLayout";
import { AuthLayout } from "./AuthLayout";
import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";

const RootComponent = (): ReactNode => {
    const { pathname } = useLocation();

    return pathname === "/login" || pathname === "/signup" ? <AuthLayout /> : <AppLayout />;
};

export { RootComponent };
