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
import { ReaderPage } from "./components/ReaderPage";
import { RootComponent } from "./components/RootComponent";
import { SettingsPage } from "./components/SettingsPage";
import { SharePage } from "./components/SharePage";
import { SignupPage } from "./components/SignupPage";
import { TagPage } from "./components/TagPage";
import { getAuthState } from "./lib/authClient";
import { isLoginRedirect } from "./lib/loginRedirect";
import { loadReaderContent } from "./lib/readerContent";
import { parseSearchQuery } from "./lib/searchQuery";
import { setUnauthorizedHandler } from "./lib/authFetch";

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
// navigation came from another site or has no Sec-Fetch-Site header, which cannot be suppressed
// like a referrer.
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
    path: "/",
    validateSearch: parseSearchQuery
});

const archiveRoute = createRoute({
    beforeLoad: requireSignedIn,
    component: ArchivePage,
    getParentRoute: () => rootRoute,
    path: "/archive",
    validateSearch: parseSearchQuery
});

const settingsRoute = createRoute({
    beforeLoad: requireSignedIn,
    component: SettingsPage,
    getParentRoute: () => rootRoute,
    path: "/settings"
});

const readerRoute = createRoute({
    beforeLoad: requireSignedIn,
    component: ReaderPage,
    getParentRoute: () => rootRoute,
    loader: ({ params }) => loadReaderContent(params.bookmarkId),
    path: "/reader/$bookmarkId"
});

const tagRoute = createRoute({
    beforeLoad: requireSignedIn,
    component: TagPage,
    getParentRoute: () => rootRoute,
    path: "/tags/$tag",
    validateSearch: parseSearchQuery
});

const loginRoute = createRoute({
    beforeLoad: requireGuest,
    component: LoginPage,
    getParentRoute: () => rootRoute,
    loader: (): Promise<AuthLoaderData> => getAuthState(),
    path: "/login",
    // A failed write can send the user here from any page, so the return URL is the current one.
    validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
        const target = search["redirect"];

        return isLoginRedirect(target)
            ? {
                  redirect: target
              }
            : {};
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
    readerRoute,
    settingsRoute,
    shareRoute,
    signupRoute,
    tagRoute
]);

const router = createRouter({
    routeTree,
    scrollRestoration: true
});

// A 401 invalidates the cached signed-in flag, so the guards have to run again to send the user
// to the login or signup page instead of leaving them on a page whose requests keep failing.
setUnauthorizedHandler(() => {
    void router.invalidate();
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

export { router };
