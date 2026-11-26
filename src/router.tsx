// oxlint-disable import/max-dependencies -- The route tree lives in one module.
import {
    type ShareRequest,
    type SharedContent,
    extractSharedUrls,
    isExternalReferrer,
    pickSharedContent
} from "./lib/shareTarget";
import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { savePendingShare, takePendingShare } from "./lib/pendingShare";
import { ArchivePage } from "./components/ArchivePage";
import { HomePage } from "./components/HomePage";
import { LoginPage } from "./components/LoginPage";
import { RootComponent } from "./components/RootComponent";
import { SettingsPage } from "./components/SettingsPage";
import { SharePage } from "./components/SharePage";
import { SignupPage } from "./components/SignupPage";
import { TagPage } from "./components/TagPage";
import { getAuthState } from "./lib/authClient";

const rootRoute = createRootRoute({
    component: RootComponent
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
// else is ignored rather than failing the whole share. The server adds "confirm" when the
// navigation came from another site (Sec-Fetch-Site), which cannot be suppressed like a referrer.
interface ShareSearch extends SharedContent {
    confirm?: string;
}

const shareSearch = (search: Record<string, unknown>): ShareSearch => {
    const content: ShareSearch = pickSharedContent(search);

    if (search["confirm"] === "1") {
        content.confirm = "1";
    }

    return content;
};

const requiresShareConfirmation = (search: ShareSearch): boolean =>
    search.confirm === "1" || isExternalReferrer(document.referrer, window.location.origin);

const shareRoute = createRoute({
    beforeLoad: async ({ search }): Promise<void> => {
        const state = await getAuthState();

        if (state.signedIn) {
            return;
        }

        // The login route cannot carry the shared text in its URL, so hand the payload over
        // through session storage and read it back when the share route runs after sign-in.
        // The confirmation decision has to travel with it: after sign-in the referrer is gone.
        if (Object.keys(search).length) {
            savePendingShare({
                content: pickSharedContent(search),
                requiresConfirmation: requiresShareConfirmation(search)
            });
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
    loader: ({ deps }): ShareRequest => {
        if (Object.keys(deps).length) {
            return {
                requiresConfirmation: requiresShareConfirmation(deps),
                urls: extractSharedUrls(deps).map((url) => url.href)
            };
        }

        const pending = takePendingShare();

        return {
            requiresConfirmation: pending?.requiresConfirmation ?? false,
            urls: extractSharedUrls(pending?.content ?? {}).map((url) => url.href)
        };
    },
    loaderDeps: ({ search }) => search,
    path: "/share",
    validateSearch: shareSearch
});

const homeRoute = createRoute({
    beforeLoad: requireSignedIn,
    component: HomePage,
    getParentRoute: () => rootRoute,
    path: "/"
});

const archiveRoute = createRoute({
    beforeLoad: requireSignedIn,
    component: ArchivePage,
    getParentRoute: () => rootRoute,
    path: "/archive"
});

const settingsRoute = createRoute({
    beforeLoad: requireSignedIn,
    component: SettingsPage,
    getParentRoute: () => rootRoute,
    path: "/settings"
});

const tagRoute = createRoute({
    beforeLoad: requireSignedIn,
    component: TagPage,
    getParentRoute: () => rootRoute,
    path: "/tags/$tag"
});

const loginRedirects = ["/settings", "/share"] as const;

const loginRoute = createRoute({
    beforeLoad: requireGuest,
    component: LoginPage,
    getParentRoute: () => rootRoute,
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
    loader: (): Promise<AuthLoaderData> => getAuthState(),
    path: "/signup"
});

const routeTree = rootRoute.addChildren([
    archiveRoute,
    homeRoute,
    loginRoute,
    settingsRoute,
    shareRoute,
    signupRoute,
    tagRoute
]);

const router = createRouter({
    routeTree
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

export { router };
