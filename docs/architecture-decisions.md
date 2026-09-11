# Architecture decisions

This log records consequential technical choices and why we made them. Exact
package versions belong in `package.json`.

[Application architecture](architecture.md) defines the current implementation
contract. This log records its rationale and consequential changes.

## Frontend and backend workspaces

- **Status:** Accepted
- **Date:** 2026-09-09
- **Decision:** Use npm workspaces for `apps/frontend` and `apps/backend`, with
  separate dependencies and configuration and one root lockfile.
- **Why:** Make application ownership explicit while keeping coordinated development
  and Convex's generated TypeScript contract.
- **Boundary:** The backend package exports generated client bindings and data-model
  types only. Existing dependency checks still prohibit importing backend
  implementations into the frontend. Reserve `packages/core` for real business
  logic; no empty package or additional build orchestrator is needed.

## Hexagonal architecture and Clean Code

- **Status:** Accepted
- **Date:** 2026-09-09
- **Decision:** Keep business rules and application use cases independent of
  frameworks. Convex endpoints and adapters connect the core through narrow,
  core-owned ports. Use cohesive modules, clear names, and explicit dependencies.
- **Why:** Agents can extend and test business behavior without coupling it to UI,
  persistence, or provider SDKs.
- **Boundary:** Simple authorized read projections use Convex directly. Preserve
  its transaction and reactive-query semantics. Do not add generic repositories,
  containers, or empty feature scaffolding.

## Architecture enforcement

- **Status:** Accepted
- **Date:** 2026-09-09
- **Decision:** Use dependency-cruiser for import boundaries and runtime cycles,
  isolated core TypeScript checks, and separate core/backend/architecture tests.
- **Why:** Documentation alone cannot prevent dependency drift. Fixtures prove
  rejection behavior even before product code exists.
- **Boundary:** Inspect type-only imports for boundaries, but permit type-only
  cycles. Review business-rule placement, feature ownership, and transaction
  behavior separately; static checks do not prove them.

## React, Vite, and TypeScript

- **Status:** Accepted
- **Date:** 2026-09-03
- **Decision:** Build the frontend with React, Vite, and strict TypeScript.
- **Why:** The product is expected to be a highly interactive client application.
  Vite keeps the build and deployment model simple.
- **Boundary:** Add server rendering only if a concrete requirement justifies it.

## Intent UI and Tailwind CSS

- **Status:** Accepted
- **Date:** 2026-09-03
- **Decision:** Use editable Intent UI components with Tailwind CSS.
- **Why:** This provides accessible React Aria primitives and a matching Figma kit.
- **Boundary:** Use only the components the product needs; prune unused source and
  dependencies when the interface stabilizes.

## Convex backend and API contract

- **Status:** Accepted
- **Date:** 2026-09-03
- **Decision:** Use Convex for persistent application data, reactive queries,
  mutations, actions, and backend workflows.
- **Why:** Its reactive model fits a collaborative application and provides
  generated end-to-end TypeScript types.
- **Boundary:** Convex validators and generated bindings are the internal API
  contract. Add OpenAPI only for a real external HTTP API.

## Client state ownership

- **Status:** Accepted
- **Date:** 2026-09-04
- **Decision:** Use feature-scoped Zustand stores for transient state shared across
  components.
- **Why:** Complex interactions need coordination without placing all state in one
  global store.
- **Boundary:** Convex owns durable shared state. URLs own shareable navigation
  state. React components retain isolated presentation state.

## Frontend hosting

- **Status:** Accepted
- **Date:** 2026-09-02
- **Decision:** Plan to deploy the Vite frontend with Convex static hosting at a
  `convex.site` address.
- **Why:** This keeps the frontend and backend on one deployment platform.
- **Boundary:** Hosting is not installed or deployed yet.

## Routing

- **Status:** Accepted
- **Date:** 2026-09-11
- **Decision:** Use TanStack Router with a code-defined typed route tree in
  `apps/frontend/src/Router.tsx`; its inline comment is the routing style guide.
- **Why:** Typed paths and validated search parameters support shareable view
  state. An explicit tree keeps the current scaffold small and reviewable. This
  supersedes the earlier file-based proposal; revisit generation as routes grow.
- **Boundary:** Routing owns navigation, layouts, and validated URL state. Convex
  retains reactive data and authorization. OAuth cleanup uses router replacement
  navigation. Hosts must serve the SPA entry point for application deep links.

## Authentication

- **Status:** Accepted; Google OAuth configuration and live round-trip verification pending
- **Date:** 2026-09-09
- **Decision:** Use Convex Auth v1 with Google OAuth for a minimal sign-in flow.
  Use its application-schema tables, not the v2 component API.
- **Why:** The product lead selected v1 for the hackathon. Google follows the
  existing sign-in proposal and avoids building password management.
- **Boundary:** Authentication proves identity; Convex functions must still enforce
  authorization. Reconsider WorkOS if durable organizations become central.
  Authentication remains in frontend/backend adapters, with no core auth framework.
  The frontend handles callback codes explicitly to display recoverable failures
  without repeating the exchange under React StrictMode.
