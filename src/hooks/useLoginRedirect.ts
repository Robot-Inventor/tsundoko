import { useLocation, useNavigate } from "@tanstack/react-router";
import { clearAuthState } from "../lib/authClient";
import { useCallback } from "react";

// A 401 leaves the cached signed-in flag stale. Dropping it before the navigation lets the login
// route's guest guard accept the redirect instead of bouncing the user back to the app.
const useLoginRedirect = (): (() => void) => {
    const navigate = useNavigate();
    const { href } = useLocation();

    return useCallback(() => {
        clearAuthState();
        void navigate({
            search: {
                redirect: href
            },
            to: "/login"
        });
    }, [href, navigate]);
};

export { useLoginRedirect };
