import { AppLayout } from "./AppLayout";
import { AuthLayout } from "./AuthLayout";
import type { ReactNode } from "react";
import { useDocumentLocale } from "../hooks/useDocumentLocale";
import { useLocation } from "@tanstack/react-router";

const RootComponent = (): ReactNode => {
    const { pathname } = useLocation();

    useDocumentLocale();

    return pathname === "/login" || pathname === "/signup" ? <AuthLayout /> : <AppLayout />;
};

export { RootComponent };
