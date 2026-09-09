# Convex Hackathon scaffold

React + Vite + TypeScript frontend with a Convex backend. The page only checks
backend connectivity. There are no product tables, write APIs, authentication,
or external-service integrations.

## Develop

Use Node.js 22.12+ and npm. Node.js 24 LTS is a suitable default.

```sh
npm ci
npm run setup:backend
npm run dev
```

Backend setup configures the deployment and writes the public frontend connection
URL into the ignored `.env.local` file. This checkout currently uses a local
Convex backend; no account login or cloud project was needed. On a fresh machine,
choose local development if prompted. Keep `.convex/` to retain local backend
state; it is ignored by Git and must not be shared.

The frontend runs at http://127.0.0.1:5173. `npm run dev` starts both development
processes; Ctrl+C stops both. They can also run separately using
`npm run dev:frontend` and `npm run dev:backend`.

## UI components

Intent UI components live in `src/components/ui/` as editable source. Tailwind CSS
v4 and Intent's default light/dark theme are wired through `src/Styles.css` and
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

The custom [Figma kit](https://www.figma.com/design/GKcLMKxdpBxMcSGL8iAdxV?node-id=5-33)
keeps all components on one page. See `design/intent-ui/README.md` for the local
reference gallery, coverage, source links, and validation notes.

## Check

```sh
npm run check
npm run build
```

`check` runs dependency-boundary checks, frontend/backend and isolated core
type-checking, tests, then formatting. Tests have separate Node core and architecture
projects and an edge-runtime backend project. An empty core is explicitly skipped
by its compiler, while architecture fixtures still run.

Use `npm run check:architecture` or `npm run typecheck:core` for focused checks.
`build` creates static frontend files in `dist/`; it does not deploy.
Use `npm run format` to format source and `npm run preview` to preview a build.
The configured backend must be running for the preview's connectivity check.

## Layout

Read [Application architecture](docs/architecture.md) before implementation.
It defines Clean Code rules, hexagonal boundaries, state ownership, and verification.
[Architecture decisions](docs/architecture-decisions.md) records the rationale.

- `src/`: React entry point, Convex provider, and minimal status page.
- `convex/`: empty schema, read-only health query, and its test.
- `convex/_generated/`: CLI-generated bindings and backend guidance; retain in Git.
- `core/`: future pure domain rules and application use cases; created with real features.
- `scripts/`: architecture checks and their fixtures.
- `.agents/skills/`: project-local agent instructions.
- `hackathon.md`: evidence-based build log.

Run `npm run codegen` when bindings need regeneration; `convex dev` normally does
this automatically. Convex-managed instructions can be refreshed with
`npx convex ai-files install`.

The intended frontend host is Convex static hosting (`convex.site`). Hosting and
production deployment are not configured. Application sign-in and authorization
must be added before exposing private data or product write APIs.
