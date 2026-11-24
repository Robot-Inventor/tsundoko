import { brand, getPageTitle, pages } from "./lib/page-title";
import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { ArchivePage } from "./components/ArchivePage";
import { HomePage } from "./components/HomePage";
import { LoginPage } from "./components/LoginPage";
import { RootComponent } from "./components/RootComponent";
import { SettingsPage } from "./components/SettingsPage";
import { SignupPage } from "./components/SignupPage";
import { getAuthState } from "./lib/authClient";

const rootRoute = createRootRoute({
    component: RootComponent,
    head: () => ({
        meta: [
            {
                title: brand
            }
        ]
    })
});

const requireSignedIn = async (): Promise<void> => {
    const state = await getAuthState();

    if (!state.signedIn) {
        // oxlint-disable-next-line typescript/only-throw-error -- TanStack Router redirects are thrown by design.
        throw redirect({
            to: state.needsSetup ? "/signup" : "/login"
        });
    }
};

interface AuthLoaderData {
    needsSetup: boolean;
    signupEnabled: boolean;
    signedIn: boolean;
}

const requireGuest = async (): Promise<AuthLoaderData> => {
    const state = await getAuthState();

    if (state.signedIn) {
        // oxlint-disable-next-line typescript/only-throw-error -- TanStack Router redirects are thrown by design.
        throw redirect({
            to: "/"
        });
    }

    return state;
};

const requireSignupAvailable = async (): Promise<AuthLoaderData> => {
    const state = await getAuthState();

    if (state.signedIn) {
        // oxlint-disable-next-line typescript/only-throw-error -- TanStack Router redirects are thrown by design.
        throw redirect({
            to: "/"
        });
    }

    if (!state.needsSetup && !state.signupEnabled) {
        // oxlint-disable-next-line typescript/only-throw-error -- TanStack Router redirects are thrown by design.
        throw redirect({
            to: "/login"
        });
    }

    return state;
};

const homeRoute = createRoute({
    beforeLoad: requireSignedIn,
    component: HomePage,
    getParentRoute: () => rootRoute,
    head: () => ({
        meta: [
            {
                title: getPageTitle(pages["/"].label)
            }
        ]
    }),
    path: "/"
});

const archiveRoute = createRoute({
    beforeLoad: requireSignedIn,
    component: ArchivePage,
    getParentRoute: () => rootRoute,
    head: () => ({
        meta: [
            {
                title: getPageTitle(pages["/archive"].label)
            }
        ]
    }),
    path: "/archive"
});

const settingsRoute = createRoute({
    beforeLoad: requireSignedIn,
    component: SettingsPage,
    getParentRoute: () => rootRoute,
    head: () => ({
        meta: [
            {
                title: getPageTitle(pages["/settings"].label)
            }
        ]
    }),
    path: "/settings"
});

const loginRoute = createRoute({
    beforeLoad: requireGuest,
    component: LoginPage,
    getParentRoute: () => rootRoute,
    head: () => ({
        meta: [
            {
                title: getPageTitle("ログイン")
            }
        ]
    }),
    loader: (): Promise<AuthLoaderData> => getAuthState(),
    path: "/login",
    // Only the settings page asks to return after signing in; keeping the union closed means no
    // user-supplied value ever reaches navigate().
    validateSearch: (search: Record<string, unknown>): { redirect?: "/settings" } => {
        if (search["redirect"] === "/settings") {
            return {
                redirect: "/settings"
            };
        }

        return {};
    }
});

const signupRoute = createRoute({
    beforeLoad: requireSignupAvailable,
    component: SignupPage,
    getParentRoute: () => rootRoute,
    head: () => ({
        meta: [
            {
                title: getPageTitle("新規登録")
            }
        ]
    }),
    loader: (): Promise<AuthLoaderData> => getAuthState(),
    path: "/signup"
});

const routeTree = rootRoute.addChildren([archiveRoute, homeRoute, loginRoute, settingsRoute, signupRoute]);

const router = createRouter({
    routeTree
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

export { router };
