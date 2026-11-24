// oxlint-disable import/max-dependencies -- The route tree lives in one module.
import { type SharedContent, extractSharedUrls } from "./lib/shareTarget";
import { brand, getPageTitle, pages } from "./lib/page-title";
import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { savePendingShare, takePendingShare } from "./lib/pendingShare";
import { ArchivePage } from "./components/ArchivePage";
import { HomePage } from "./components/HomePage";
import { LoginPage } from "./components/LoginPage";
import { RootComponent } from "./components/RootComponent";
import { SettingsPage } from "./components/SettingsPage";
import { SharePage } from "./components/SharePage";
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

// A share target delivers its payload as query parameters. Only strings are kept; anything
// else is ignored rather than failing the whole share.
const shareSearch = (search: Record<string, unknown>): SharedContent => {
    const content: SharedContent = {};

    for (const key of ["text", "title", "url"] as const) {
        const value = search[key];

        if (typeof value === "string") {
            content[key] = value;
        }
    }

    return content;
};

const shareRoute = createRoute({
    beforeLoad: async ({ search }): Promise<void> => {
        const state = await getAuthState();

        if (state.signedIn) {
            return;
        }

        // The login route cannot carry the shared text in its URL, so hand the payload over
        // through session storage and read it back when the share route runs after sign-in.
        if (Object.keys(search).length) {
            savePendingShare(search);
        }

        if (state.needsSetup) {
            // oxlint-disable-next-line typescript/only-throw-error -- TanStack Router redirects are thrown by design.
            throw redirect({ to: "/signup" });
        }

        // oxlint-disable-next-line typescript/only-throw-error -- TanStack Router redirects are thrown by design.
        throw redirect({
            search: {
                redirect: "/share"
            },
            to: "/login"
        });
    },
    component: SharePage,
    getParentRoute: () => rootRoute,
    loader: ({ deps }): string[] => {
        const content = Object.keys(deps).length ? deps : (takePendingShare() ?? {});

        return extractSharedUrls(content).map((url) => url.href);
    },
    loaderDeps: ({ search }) => search,
    path: "/share",
    validateSearch: shareSearch
});

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

const loginRedirects = ["/settings", "/share"] as const;

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
    // Only the pages that ask to return after signing in are accepted; keeping the union closed
    // means no user-supplied value ever reaches navigate().
    validateSearch: (search: Record<string, unknown>): { redirect?: (typeof loginRedirects)[number] } => {
        const target = loginRedirects.find((path) => path === search["redirect"]);

        if (!target) {
            return {};
        }

        return {
            redirect: target
        };
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

const routeTree = rootRoute.addChildren([archiveRoute, homeRoute, loginRoute, settingsRoute, shareRoute, signupRoute]);

const router = createRouter({
    routeTree
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

export { router };
