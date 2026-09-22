import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  lazyRouteComponent,
  redirect,
  Outlet,
} from "@tanstack/react-router";
import App from "./App";
import { parseAuthSearch } from "./features/auth/ParseAuthSearch";

/**
 * Routing style guide for future agents
 *
 * - This is the frontend's code-defined route tree. Register each route beneath
 *   its actual parent with getParentRoute and addChildren. Keep inferred types;
 *   do not widen routes to AnyRoute or cast navigation targets to bypass checks.
 * - Keep route configuration here and page UI in feature modules. Split route
 *   definitions when needed; feature components use getRouteApi("/route") rather
 *   than importing this router (which would create a runtime import cycle).
 * - Use TanStack Link for internal links and route-scoped useNavigate for actions.
 *   Pass literal `to` paths and typed `params`/`search`, not interpolated URLs.
 *   Use ordinary anchors for external links. buildLocation produces typed URLs
 *   when an external API, such as OAuth redirectTo, requires a string.
 * - Validate untrusted search values at their owning route with validateSearch.
 *   Return an explicit shape and sensible defaults; never cast raw URL input.
 *   Path params identify resources; search holds shareable view state. Ephemeral
 *   interaction state stays in React/Zustand. Anonymous share capabilities use
 *   only the URL fragment; never put secrets in path or search parameters.
 * - Change URLs through the router, not window.history. Use replace for cleanup
 *   (especially one-time OAuth codes), and push for user navigation. Preserve
 *   unrelated validated search state and hashes when updating part of a URL.
 * - Convex owns reactive data and server authorization. Route guards improve UX
 *   but are not a security boundary. Do not duplicate subscriptions in a router
 *   cache or introduce loaders unless navigation genuinely needs them.
 * - Add only real routes, with nested layouts using Outlet. Keep the global
 *   not-found recovery usable. Hosting must serve index.html for app deep links.
 * - Verify direct URLs, back/forward, unknown paths, malformed search, and auth
 *   callbacks when changing routing. The Register augmentation below makes Link,
 *   navigation and route hooks check against this exact tree application-wide.
 */
const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <main className="scaffold">
      <h1>Page not found</h1>
      <Link to="/" search={{}}>
        Return home
      </Link>
    </main>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    code?: string;
    authReturn?: boolean;
  } => ({
    code:
      typeof search.code === "string" && search.code.length > 0
        ? search.code
        : undefined,
    authReturn:
      search.authReturn === true ||
      search.authReturn === 1 ||
      search.authReturn === "1"
        ? true
        : undefined,
  }),
  component: App,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: lazyRouteComponent(() => import("./features/admin/AdminRoute")),
});
const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/$workspaceId",
  component: lazyRouteComponent(
    () => import("./features/workspaces/WorkspaceRoute"),
  ),
});

const shareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/share",
  component: lazyRouteComponent(
    () => import("./features/workspaces/ShareJoinRoute"),
  ),
});

const documentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/document",
  beforeLoad: () => {
    throw redirect({ to: "/canvas", replace: true });
  },
});

const canvasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/canvas",
  component: lazyRouteComponent(() => import("./features/canvas/CanvasPage")),
});

// Preserve existing prototype bookmarks while the feature lives at its durable route.
const legacyPrototypeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/prototypes/p00",
  beforeLoad: () => {
    throw redirect({ to: "/canvas", replace: true });
  },
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    homeRoute,
    workspaceRoute,
    shareRoute,
    adminRoute,
    canvasRoute,
    documentRoute,
    legacyPrototypeRoute,
  ]),
  parseSearch: parseAuthSearch,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
