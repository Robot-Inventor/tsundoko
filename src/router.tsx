import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppLayout } from "./components/AppLayout";
import { ArchivePage } from "./components/ArchivePage";
import { HomePage } from "./components/HomePage";

const rootRoute = createRootRoute({
    component: AppLayout
});

const homeRoute = createRoute({
    component: HomePage,
    getParentRoute: () => rootRoute,
    path: "/"
});

const archiveRoute = createRoute({
    component: ArchivePage,
    getParentRoute: () => rootRoute,
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
