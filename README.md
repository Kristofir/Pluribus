# Convex Hackathon scaffold

React + Vite + TypeScript frontend with a Convex backend. The page checks
backend connectivity and integrates Convex Auth v1 with Google sign-in.
The shared document canvas at `/canvas` uses core domain rules and use cases,
Convex persistence, and a feature-scoped Zustand interaction store. Google sign-in is configured
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
auth callbacks, and Convex boundaries. The home route renders the workspace dashboard; `/canvas` loads the multiplayer
canvas. Unknown paths show a recovery link. The deployment host must serve `index.html` for deep links.

## Shared canvas

[Canvas behavior spec](docs/canvas-behavior.md) defines expected interactions and how to verify changes.

Open `/canvas` in two local browser sessions. Add document cards, drag them,
resize selected cards and delete with the toolbar or Delete/Backspace. Pan, zoom
and selection belong to each client. Shared geometry persists in local Convex;
the latest accepted update wins. Editing pauses offline. The canvas supports 100
active document cards. Rectangles are retired; their stored rows and historical
receipts are retained but cannot be restored or changed.
The shared canvas allows anonymous participants; private workspaces enforce
membership separately; see [Workspace prototype](docs/workspaces.md).
The previous `/prototypes/p00` URL redirects to `/canvas`.
See [P00 evidence and repeatable checks](docs/research/prototypes.md#p00--multiplayer-canvas-basics).

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

Firecrawl HTTP contracts and capture-job failure recovery run in the normal test
suite. For a real provider smoke test, supply `FIRECRAWL_API_KEY` securely in the
shell environment and run:

```sh
FIRECRAWL_LIVE_TEST=1 npx vitest run apps/backend/convex/Firecrawl.test.ts
```

This captures `example.com`, consumes provider credits, and writes no workspace
data. It verifies provider connectivity, not support for every website. HTTP 403
can indicate an unsupported or access-restricted site; successful configuration
does not make such sites retrievable.

## Layout

Read [Application architecture](docs/architecture.md) before implementation.
It defines Clean Code rules, hexagonal boundaries, state ownership, and verification.
[Architecture decisions](docs/architecture-decisions.md) records the rationale.

This is an npm workspace with one root lockfile. Run `npm ci` at the repository
root. Each app declares its own dependencies and owns its runtime configuration:

- `apps/frontend/`: React/Vite app; package `@pluribus/frontend`.
- `apps/backend/`: Convex app; package `@pluribus/backend`.
- `packages/core/`: framework-independent canvas rules and use cases; package `@pluribus/core`.
- Root scripts coordinate development, builds, and checks.

The frontend imports `@pluribus/backend/api` and may import types from
`@pluribus/backend/dataModel`. These are the backend package's only exports;
server implementations are private. `packages/core/` contains framework-independent canvas rules and write use cases.

- `apps/frontend/src/`: React entry point, auth provider, status page, and account UI.
- `apps/backend/convex/`: auth, health, canvas endpoints and persistence adapters, migrations component, and tests.
- `apps/backend/convex/_generated/`: CLI-generated bindings and backend guidance; retain in Git.
- `packages/core/`: dependency-free canvas domain rules, access policy, use cases, and persistence ports.
- `scripts/`: architecture checks and their fixtures.
- `.agents/skills/`: project-local agent instructions.
- `hackathon.md`: evidence-based build log.

Run `npm run codegen` when bindings need regeneration; `convex dev` normally does
this automatically. Convex-managed instructions can be refreshed with
`npx convex ai-files install` from `apps/backend`.

The intended frontend host is Convex static hosting (`convex.site`). Hosting and
production deployment are not configured. Verify sign-in and add resource-level
authorization before exposing private product data or product write APIs.

## Collaborative document

Open `/canvas` in two browser sessions and edit the same document card. Cards
support headings, bold, lists, per-client undo/redo and **Show authors**. Convex
ProseMirror Sync stores incremental edit steps and periodic snapshots. “Saved”
means the editor has no unacknowledged steps. Editing pauses offline; keep the tab
open for pending edits to recover. Pending work is not stored durably offline.

## Documents on the canvas

Use **Add document** for up to 100 active child cards. Drag by the outer padding
and edit the text directly. Delete removes a document from the canvas; **Undo**
restores its saved text and position, and **Redo** deletes it again.
Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z use personal Element History outside text inputs;
focused editors keep their own text undo. Creation also records one entry: Undo
hides the created Element; Redo restores its identity and saved content.
Deletions produce one entry per Element;
move/resize gestures produce one entry for the whole group. Geometry Undo/Redo is
conditional: a later conflicting move or another session’s lifecycle change prevents
restoration. Your own delete/restore cycles preserve earlier Canvas History.
Accepted request retries keep their original outcome; interrupted gestures close
at their last accepted geometry. Protocol bookkeeping stays behind the History facade.
History lasts while this canvas is open; reloading or leaving the route clears it.
There is no time-based expiry or automatic permanent purge yet.

If another client deletes a document with pending edits, a local recovery notice
retains a readable copy and JSON download. Recovery survives route changes until
explicitly discarded, but is lost on reload or account change. Undo opens saved
content with a fresh editing session and never replays old pending text.
`/document` redirects to `/canvas`; existing standalone stored content is retained.

## Web Pages

In a private workspace, **Add web page** captures a URL with an optional extraction
prompt. Cards support selection, movement, resizing, full read-only capture viewing,
refresh and inclusion in agent context. Refresh failures retain the previous capture.
Creation, geometry and deletion participate in Canvas Undo/Redo. Up to 20 Web Pages
are supported separately from the 100-document limit; captures are not editable text.
