# Convex Hackathon scaffold

React + Vite + TypeScript frontend with a Convex backend. The page checks
backend connectivity and integrates Convex Auth v1 with Google sign-in.
There are no product tables or product write APIs. Google sign-in is configured
and verified locally; see [Authentication](docs/authentication.md) for fresh setup.

## Develop

Use Node.js 22.12+ and npm. Node.js 24 LTS is a suitable default.

```sh
npm ci
npm run setup:backend
npm run dev
```

Backend setup configures the deployment in `apps/backend/.env.local`, then copies
only the public connection URL to `apps/frontend/.env.local`. Run
`npm run sync:frontend-env` after changing the backend target. This checkout uses
a local Convex backend; choose local development on a fresh machine if prompted.
Keep `apps/backend/.convex/` to retain its data and keys. Environment files and
local backend state are ignored by Git and must not be shared.

The frontend runs at http://127.0.0.1:5173. `npm run dev` starts both development
processes; Ctrl+C stops both. They can also run separately using
`npm run dev:frontend` and `npm run dev:backend`.

## Routing

TanStack Router defines the typed route tree in `apps/frontend/src/Router.tsx`.
Its inline style guide covers adding routes, typed navigation, URL validation,
auth callbacks, and Convex boundaries. Currently `/` renders the scaffold; unknown
paths show a recovery link. The deployment host must serve `index.html` for deep links.

## UI components

Intent UI components live in `apps/frontend/src/components/ui/` as editable source. Tailwind CSS
v4 and Intent's default light/dark theme are wired through `apps/frontend/src/Styles.css` and
the Vite plugin. Import components with the `@/` alias.

The complete `@intentui/all` registry set is installed: 89 UI source files plus
shared hooks and helpers. The app includes a theme provider (light by default)
and the Toast host. Use `useTheme()` to change the theme and `toast` from `sonner`
to show notifications. Add future Intent components using the configured registry:

```sh
npx shadcn@latest add @intentui/select
```

Use the `@intentui/` prefix to get Intent implementations. Review upstream changes
before overwriting customized component files.
Run component installation commands from `apps/frontend`, where `components.json`
and the frontend aliases live.

The custom [Figma kit](https://www.figma.com/design/GKcLMKxdpBxMcSGL8iAdxV?node-id=5-33)
keeps all components on one page. See `design/intent-ui/README.md` for the local
reference gallery, coverage, source links, and validation notes.

## Check

```sh
npm run check
npm run build
```

`check` runs dependency-boundary checks, frontend/backend and isolated core
type-checking, tests, then formatting. Tests have separate Node frontend, core, and architecture
projects and an edge-runtime backend project. An empty core is explicitly skipped
by its compiler, while architecture fixtures still run.

Use `npm run check:architecture` or `npm run typecheck:core` for focused checks.
`build` creates static frontend files in `apps/frontend/dist/`; it does not deploy.
Use `npm run format` to format source and `npm run preview` to preview a build.
The configured backend must be running for the preview's connectivity check.

## Layout

Read [Application architecture](docs/architecture.md) before implementation.
It defines Clean Code rules, hexagonal boundaries, state ownership, and verification.
[Architecture decisions](docs/architecture-decisions.md) records the rationale.

This is an npm workspace with one root lockfile. Run `npm ci` at the repository
root. Each app declares its own dependencies and owns its runtime configuration:

- `apps/frontend/`: React/Vite app; package `@pluribus/frontend`.
- `apps/backend/`: Convex app; package `@pluribus/backend`.
- Root scripts coordinate development, builds, and checks.

The frontend imports `@pluribus/backend/api` and may import types from
`@pluribus/backend/dataModel`. These are the backend package's only exports;
server implementations are private. `packages/core/` is reserved for future
business logic and is not created until it contains real code.

- `apps/frontend/src/`: React entry point, auth provider, status page, and account UI.
- `apps/backend/convex/`: auth schema and endpoints, current-user query, health query, and tests.
- `apps/backend/convex/_generated/`: CLI-generated bindings and backend guidance; retain in Git.
- `packages/core/`: future pure domain rules and application use cases; created with real features.
- `scripts/`: architecture checks and their fixtures.
- `.agents/skills/`: project-local agent instructions.
- `hackathon.md`: evidence-based build log.

Run `npm run codegen` when bindings need regeneration; `convex dev` normally does
this automatically. Convex-managed instructions can be refreshed with
`npx convex ai-files install` from `apps/backend`.

The intended frontend host is Convex static hosting (`convex.site`). Hosting and
production deployment are not configured. Verify sign-in and add resource-level
authorization before exposing private product data or product write APIs.
