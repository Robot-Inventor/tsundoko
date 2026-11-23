import { brand, getPageTitle, pages } from "./lib/page-title";
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppLayout } from "./components/AppLayout";
import { ArchivePage } from "./components/ArchivePage";
import { HomePage } from "./components/HomePage";

const rootRoute = createRootRoute({
    component: AppLayout,
    head: () => ({
        meta: [
            {
                title: brand
            }
        ]
    })
});

const homeRoute = createRoute({
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

const routeTree = rootRoute.addChildren([archiveRoute, homeRoute]);

const router = createRouter({
    routeTree
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

export { router };
