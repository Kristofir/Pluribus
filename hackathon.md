# Hackathon log

- **Project:** ConvexHackathon
- **Event:** Convex All Gas Hackathon
- **What it does:** Framework scaffold with a React frontend and local Convex backend; no product features yet.
- **Live app:** not deployed
- **Repo:** none
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** none
- **Convex features:** auth schema and indexes, queries, auth actions and mutations, HTTP actions, realtime client connection
- **Auth:** Convex Auth
- **AI models:** none
- **Started:** 2026-09-02T19:44:18Z
- **Last updated:** 2026-09-11T08:08:34Z

## Log

### 2026-09-02

Started environment setup in an empty workspace with no Git history or application.
Installed and validated the project-local hackathon build-log skill in
`.agents/skills/convex-hackathon-skill/`. The start time reflects this setup,
not earlier product work; the installation timestamp is weaker evidence than Git history.
Verified the global Convex Codex plugin 1.10.0 is installed and enabled, with
skills and MCP configuration present. After restart, the Convex and hackathon
skills are loaded and Convex MCP tools are callable. A read-only status check
reached the MCP server but returned Not Authorized; account access remains unverified.
Selected Convex static hosting for the later frontend build. No application was built
or deployed; the hosting component is deferred until a Convex application exists.

### 2026-09-03 - working tree

Added React, Vite, TypeScript, and a local Convex development backend, with no
product tables or write APIs (`src/`, `convex/schema.ts`, `convex/Health.ts`).
Verified the frontend reports a live backend connection; the read-only health
query, isolated test, frontend/backend type checks, and static build passed.
Initialized Git, locked dependencies, and added development commands, formatting,
project instructions, and generated Convex guidance. No cloud deployment,
application authentication, external integrations, commit, or push was performed.

### 2026-09-03 - working tree - Intent UI

Installed Intent UI's default theme and complete component registry: 89 editable
UI source files plus shared hooks and helpers, with Tailwind CSS v4 and Vite aliases.
The existing connectivity page now uses Intent Card and Badge components;
corrected missing card theme tokens and an invalid installed radius variable.
Formatting, type checks, the existing backend test, and the production build
passed. Added the theme provider required by Toast and mounted its notification host.
A local browser check confirmed the light theme, notification host, styled components,
a connected Convex backend, and no console errors. No product features or deployment were added.

### 2026-09-03 - working tree - Figma component kit

Created a custom draft Figma kit with 94 component sets and 303 desktop specimens,
grouped on one Components page, plus light/dark foundations and a theme reference.
Added the local component gallery and source-to-Figma index in `design/intent-ui/`.
Visual and binding checks passed; inherited palette contrast limitations are documented.
Type checks, the test, build, and formatting of changed files passed. Whole-workspace
formatting remains blocked by unrelated research files. No library publication,
Code Connect publication, application deployment, commit, or push was performed.

### 2026-09-04 - working tree - client state foundation

Installed Zustand for future feature-scoped client state without creating a store
or adding product behavior (`package.json`, `package-lock.json`). Durable shared
data remains assigned to Convex, while isolated presentation state remains local
to React components.

### 2026-09-09 - working tree - architecture contract

Added the Clean Code and hexagonal architecture contract, linked from agent
instructions and the README, with dependency checks and isolated core compilation.
Architecture checks scanned 98 source files; all 24 tests and the build passed.
The full check reaches formatting and fails on 92 pre-existing research files,
which were left unchanged. The build also reports unresolved texture-asset warnings.
No product APIs, tables, integrations, deployment, commit, or push were added.

### 2026-09-09 - working tree - authentication

Integrated Convex Auth v1 with Google, account controls, callback error recovery,
and an identity-derived current-user query. Pinned patched auth dependencies.
The local backend accepted the schema and functions; type checks, 27 tests,
build, auth discovery endpoints, and browser failure-state checks passed.
Google client configuration and a successful sign-in/sign-out remain pending.
The existing 92 research formatting failures and texture warnings remain;
no cloud deployment, commit, or push was performed.

### 2026-09-09 - working tree - frontend and backend workspaces

Separated React/Vite and Convex into `apps/frontend` and `apps/backend`, each with
its own dependencies and configuration, coordinated by npm workspaces and one lockfile.
Preserved the existing auth implementation and moved local backend state intact.
Updated architecture checks, client package exports, development commands, and design references.
All 28 tests, type checks, frontend build, local Convex setup, browser connection,
and the design gallery passed. Full formatting still flags 92 existing research files.
Google OAuth configuration remains pending; no cloud deployment, commit, or push.

### 2026-09-09 - working tree - Google OAuth verified locally

Configured the Google consent screen, a local web OAuth client, and test-user access.
Installed client credentials only on the local Convex backend and removed temporary credential files.
Chrome verified Google sign-in, the authenticated callback, reload and second-tab
persistence, and sign-out across both tabs. Second-account and long-lived renewal
checks remain pending; no application deployment, commit, or push was performed.

### 2026-09-09 - working tree - provisional vocabulary

Captured six provisional domain concepts, their working meanings, and open questions
in `docs/research/vocabulary.md`, linked from the product notes. Added a discussion
record for future decisions; no domain entities or product behavior were implemented.

### 2026-09-11 - working tree - typed frontend routing

Added TanStack Router with a code-defined typed route tree and an inline agent style guide.
The home route validates auth search values; unknown URLs offer a typed return link.
OAuth callback codes retain their exact string value, with regression coverage for numeric codes.
Browser checks verified navigation, back/forward, callback cleanup, Google sign-in,
reload persistence, and sign-out. No deployment, commit, or push was performed.
