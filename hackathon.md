# Hackathon log

- **Project:** ConvexHackathon
- **Event:** Convex All Gas Hackathon
- **What it does:** React frontend with Google sign-in and local multiplayer canvas and collaborative rich-text features.
- **Live app:** not deployed
- **Repo:** https://github.com/Kristofir/Pluribus
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** @convex-dev/migrations, @convex-dev/prosemirror-sync, @convex-dev/presence
- **Convex features:** auth schema and indexes, queries, auth actions and mutations, HTTP actions, realtime queries, rectangle table and mutations
- **Auth:** Convex Auth
- **AI models:** none
- **Started:** 2026-09-02T19:44:18Z
- **Last updated:** 2026-09-20T08:30:46Z

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

### 2026-09-14 - working tree - shared canvas model

Recorded entity hierarchy and element-kind diagrams in `docs/research/canvas-model.md`,
linked from the vocabulary and architecture contract. Distinguished canvas placement
from editable content, and agreed direction from proposed relationships and element
kinds. Added the Web source element, dated page captures, and prompt-based extraction
results as working concepts. This is documentation only; no product schema,
synchronization, or Firecrawl integration was implemented.
Architecture checks, type checks, 31 tests, and the build passed. The full check
stopped on unrelated formatting in `convex/_generated/ai/guidelines.md`.

### 2026-09-14 - working tree - prototype register

Added `docs/research/prototypes.md` with a staged content-anchoring experiment,
expected evidence, and candidate experiments for human/AI edits, dependencies,
web captures, and canvas sessions. Prioritized a two-client rectangle canvas as
P00, before text work; deferred the formal state machine and conflict policies.
Scoped P00 to anonymous participants on one canvas, without sign-in or permissions.
Recorded a later integration scenario.
All experiments remain unstarted; this update only documents the research plan.

### 2026-09-15 - working tree - P00 multiplayer rectangles

Implemented the anonymous React Flow canvas at `/prototypes/p00` with rectangle
CRUD and reactive geometry in the existing local Convex backend. Two browser
clients verified live movement/resize, independent and same-object edits, deletion
during dragging, reload persistence, personal viewports, and disconnect recovery.
Architecture/type checks, 45 tests, and the build passed. The full check still
flags existing formatting in `convex/_generated/ai/guidelines.md`. Human usability
evaluation remains pending; this prototype does not establish workspace authorization or a final
canvas model. No cloud deployment, commit, or push was performed.

### 2026-09-15 - working tree - canvas architecture correction

Moved the runtime feature to `/canvas` with core domain rules, write use cases,
transaction-bound Convex adapters, and a feature-scoped Zustand interaction store.
Removed the P00 architectural exception; anonymous access is an explicit core policy.
Used the official migrations component to preserve both legacy rectangles exactly
in `rectangles`, then retired the old schema and migration. Old bookmarks redirect.
Architecture checks, isolated core compilation, 52 tests, and build passed; two
browser clients reverified manipulation, concurrency, persistence, disconnect
recovery, and navigation. The existing generated-guidance formatting issue remains.
Human usability evaluation is pending. No cloud deployment, commit, or push.

### 2026-09-15 - working tree - explicit canvas API

Collected public canvas declarations in `apps/backend/convex/Canvas.ts`, with
ordinary handlers in `canvas/Handlers.ts` and frontend calls through `api.Canvas`.
Added a type-aware architecture rule rejecting public endpoints outside designated
entrypoints, including aliases and re-exports. Generated bindings and the local
canvas query verified successfully. Architecture/type checks, 53 tests, and build
passed; the existing generated-guidance formatting issue remains.

### 2026-09-15 - working tree - Collaborative text

Added a standalone shared Tiptap document at `/document`, backed by Convex
ProseMirror Sync steps and snapshots. Core owns identity/access/initialization;
explicit backend endpoints validate sync content and preserve native rebasing.
Sixty tests pass, including concurrency, per-client undo, malformed writes, and
snapshot reconstruction. Browser checks confirm two-client edits, per-user undo,
reload, pending-navigation blocking, and offline/reconnect behavior. Architecture,
type checks, and build pass; formatting retains the pre-existing generated-guidance
warning. No cloud deployment.

### 2026-09-15 - working tree - Backend documentation

Focused JSDoc on public backend APIs, core use cases, architectural boundaries,
and non-obvious transaction/sync behavior. Removed repetitive comments on payloads,
validators, and wrappers. Generated files and runtime behavior are unchanged.

### 2026-09-16 - working tree - presence model

Documented proposed sessions, context participation, and typed activity in the
shared canvas model. Updated its diagram and recorded anonymous identity defaults
and unresolved visibility/mapping questions. No presence implementation added.

### 2026-09-16 - working tree - Presence implementation

Added shared session/context presence with official component expiry, capability
checks, independent activity channels, and reference-counted frontend leases.
Canvas shows pointers, selections, and manipulation; documents show mapped remote
carets/ranges without adding editor history. Hidden/reconnect behavior drops stale
activity. Seventy-three tests pass, including real component expiry and delayed
ordering. Local browser checks verify multiple guests/tabs, canvas activity, text
selection/undo, reconnect, and simulated hidden expiry. Delayed text acknowledgements
produced no passive-viewer presence writes or roster updates. Cost observations and
unverified scale/background behavior are recorded in the prototype register.
No cloud deployment, commit, or push.

### 2026-09-16 - working tree - Canvas document ownership

Recorded documents as child canvas elements containing collaborative text.
Updated entity diagrams, vocabulary, architecture, and the decision record.
Geometry and text retain separate synchronization; no runtime changes or embedding.

### 2026-09-16 - working tree - Canvas document children

Embedded two canvas-owned collaborative document cards, preserving rectangles and
standalone text. Atomic creation and inherited canvas access protect ownership;
reversible removal retains saved text and rejects stale editing generations.
Editors survive movement/offscreen positioning; remote removal preserves local
recovery with explicit discard. Tests and two-client browser checks cover isolation,
concurrent movement/typing, undo, removal/recovery, pending guards and reconnect.
No cloud deployment, commit, or push.

Validation: 76 tests pass with a 20 s timeout; default 5 s architecture fixtures
hit timeouts on this machine. The architecture scan and build pass. Existing
generated-guidance formatting and bundle-size warnings remain.

### 2026-09-16 - working tree - Preserve recovery through query failures

Canvas and document reads now report failures without unmounting loaded editors.
Editing pauses while the last successful query value and local recovery remain.
Initial snapshot loading is isolated per card; the official sync extension remains
unchanged. Browser fault injection verified canvas/version errors preserve editor
identity and recovery text, and restoration preserves saved content.

Initial-snapshot fault injection also verified that another card keeps its editor,
text synchronization, and undo history while the failed card recovers.

Validation: all 78 tests pass, with architecture fixtures rerun at a 20 s timeout.
Architecture scan, type checks and build pass; existing formatting/bundle warnings remain.

### 2026-09-16 - working tree - Central presence policy

Canvas, editor and browser handlers emit typed events. A pure core policy owns
membership intent, channel ownership and activity clearing; the registry executes
transport effects. Blur retains activity, while hidden tabs retain last accepted
activity until official membership expiry. Late rejected writes cannot prematurely
remove away presence. React alone owns editor attachment, preventing stale editor
callbacks from disconnecting passive cursor rendering.

Policy, registry, backend expiry and editor-attachment regression tests pass.
Two-client browser checks verify editor/window blur, unfocused heartbeats, simulated
hidden-tab retention/expiry and fresh return without changing text. Architecture,
type checks and build pass; existing generated-guidance formatting and bundle-size
warnings remain. No cloud deployment, commit or push.

### 2026-09-16 - working tree - Quieter document cards

Embedded document cards omit the collaborator bar and routine Saved/Saving status.
Document presence remains active; connection/recovery messages remain available.
The standalone document surface retains its existing controls.

### 2026-09-16 - working tree - Current-text authorship prototype

Added authored text spans, stable author credentials and operation receipts around
the existing ProseMirror protocol. Shared editor adapters preserve operation intent;
the backend validates attribution and restoration before atomically accepting text
and evidence. The standalone editor has authorship display and explicit move controls.
Six focused tests verify marking/rebase, undo/redo, atomic forgery rejection and
explicit moves. Two-client browser checks verified typing, formatting, foreign-text
undo, move/undo, display and reload; original content was restored. Architecture
checks over 174 files, type checks, 91 tests and build pass. Existing generated-
guidance formatting and bundle-size warnings remain. Activation is restricted
server-side to the standalone document; canvas cards stay unchanged.

Initial synthetic storage fixtures measured 1,024 bytes of one-author text as
1,109 bytes of ordinary document JSON and 1,195 bytes with attribution. Alternating
32-character authorship grew attributed JSON to 4,667 bytes; per-character
fragmentation was much larger. The prototype register separates current content,
author/session records, operation evidence and step payloads, and identifies unmeasured
storage costs. No cloud deployment, commit or push.

### 2026-09-17 - working tree - Canvas document authorship

Moved author highlights and explicit moves into canvas document cards; retired the
standalone page with a redirect. Cards share guest identity but use independent
scoped sessions. Lifecycle tests reject old-session writes after restoration while
retaining attribution. All 93 tests and build pass; two-client checks verified both
cards, undo, highlights and reload. No cloud deployment, commit or push.

### 2026-09-17 - working tree - Quiet canvas toolbar

Removed routine Saved/Saving labels from the canvas toolbar. Disconnection and
error messages remain available; synchronization behavior is unchanged.

### 2026-09-17 - working tree - Grouped domain vocabulary

Grouped existing models by responsibility and separated implemented concepts from
product proposals. Document remains the canvas element; the proposed Document Card
domain split is explicitly unresolved. No runtime behavior changed.

### 2026-09-17 - working tree - Shared canvas element model

Introduced ElementBase, DocumentElement and RectangleElement in the core domain,
with a discriminated union consumed by canvas projection code. Core persistence
contracts now reference the shared types. Storage, API contracts and deletion
behavior remain unchanged. Vocabulary and architecture record the decision.

### 2026-09-17 - working tree - Shared geometry rules and explicit dispatch

Moved geometry validation into a shared domain module and routed canvas geometry
writes by element kind. Queued document writes retain their captured generation;
missing targets do not fall back to rectangle writes. Focused checks cover routing,
generation capture, geometry bounds and existing canvas lifecycle behavior. All
95 tests, typechecks and build pass; the local backend starts successfully and
the canvas reconnects. The existing generated-guidelines formatting warning remains.

### 2026-09-17 - working tree - Trackpad canvas controls

Configured React Flow for two-finger scroll panning and pinch zooming. Ordinary
scroll no longer zooms the canvas. Typechecks and build pass; physical trackpad
gestures have not been manually verified.

### 2026-09-17 - working tree - Application responsibilities

Moved authorship acceptance and restoration coordination into core application
operations with opaque proof and transaction-bound evidence ports. Standardized
canvas handlers and separated frontend commands/projection and editor lifecycle
from rendering. Existing sync, presence, schema and retention behavior remain.
All 104 tests, typechecks and build pass; architecture checks cover 187 files.
Local verification showed two-client edit/undo convergence, a stable editor node,
author controls and retained read-only recovery. The existing generated-guidelines
formatting failure and bundle-size warning remain.

### 2026-09-17 - working tree - Canvas render isolation

Preserved unchanged node and callback references, memoized node components, and
separated toolbar/error subscriptions from scene updates. Cursor activity no longer
rebuilds the scene when roster state is unchanged. Editors remain mounted offscreen.
All 106 tests and build pass; browser checks retained both editor DOM instances
through a temporary rectangle interaction and cleanup. Existing generated-file
formatting and bundle-size warnings remain; no frame-rate benchmark was run.

### 2026-09-18 - working tree - Text-only document cards

Removed the title bar, formatting and authorship controls, and inset editor box
from active canvas document cards. Outer padding provides the drag area; recovery
and sync-error controls remain available when needed. Browser checks verified
padding drag and editable text without remounting the editor. All 106 tests and
build pass; the existing generated-file formatting warning remains.

### 2026-09-18 - working tree - Personal document-deletion history

Deleted document cards disappear and free active capacity. Personal Undo/Redo uses
transactional backend receipts and retained saved text with fresh editing generations;
there is no timer or automatic purge. Pending local text survives card unmount and
route changes in memory. Two-client browser checks verified delete/Undo/Redo and keyboard
Undo; withholding a text submission verified recovery without replay into restored text.
Test overrides were removed and original documents restored. No commit or cloud deploy.

Validation: 120 tests, architecture checks (196 source files), typechecks and production
build pass. The existing generated-guidelines formatting failure and bundle-size warning
remain. Local compatibility recovery found no legacy removed cards to restore.

### 2026-09-19 - working tree - Content-sized document height

Document cards cannot resize below rendered content plus padding and grow when
new lines overflow. Extra height persists and the document-only height cap is
removed. Browser checks measured an 89px minimum growing to 128px after a newline;
a 500px card stayed 500px with spare room. Test edits and size were restored.
All 120 tests and build pass; the existing generated-file formatting warning remains.

### 2026-09-19 - working tree - Magnetic canvas alignment

Elements snap to edges and centers during movement and resizing, with local guides
and Alt/Option bypass. Group spacing and document content minimums are preserved.
Core owns the pure geometry resolver; frontend owns gesture state and frozen targets.
Persisted elements retain one geometry through the existing throttled write path.
Browser checks verified snapping, release, modifier bypass, resizing and persistence
after reload; the temporary test rectangle was removed. All 129 tests, typechecks,
architecture checks and build pass. The existing generated-guidelines formatting
failure and bundle-size warning remain.

### 2026-09-19 - working tree - Smooth snapping

Snap acquisition, release and Alt/Option changes ease over 140ms while ordinary
pointer movement remains immediate. Browser animations affect presentation only,
including resize correction; reduced-motion preferences disable motion. Browser
checks sampled in-flight and settled geometry and verified reduced-motion behavior.
The temporary test rectangle was removed. All 129 tests, typechecks and build pass;
the existing generated-file formatting failure and bundle-size warning remain.

### 2026-09-19 - working tree - Dark theme

Connected canvas surfaces, cards, controls, guides and document recovery to shared
theme tokens. Added Light/Dark/System selectors to the home page and canvas, with
dark as the default for unsaved preferences and saved theme applied before first
paint. Browser checks verified switching, live system changes and reload persistence.
All 129 tests, typechecks, architecture checks and build pass; the existing generated
guidelines formatting failure and bundle-size warning remain.

### 2026-09-19 - working tree - Selection handle prototype reverted

Tried small corner handles with larger grab areas, then reverted the prototype
after user review. Original resize controls are restored; dark theme and snapping
remain unchanged.

### 2026-09-19 - working tree - Canvas behavior spec

Added a concise behavior spec for navigation, geometry, snapping and document cards.
Project instructions now require checking affected rules and reporting evidence or
gaps. Initial source review informed the spec; this documentation change does not
claim a fresh browser conformance audit.

### 2026-09-19 - working tree - Element event tables

Grouped conditional event behavior by canvas background, rectangle and document
card in the behavior spec. Selection modifiers, double-click and keyboard movement
remain explicitly undecided. Documentation only; no new interaction audit claimed.

### 2026-09-19 - working tree - Navigation over elements

Clarified pan/pinch behavior over rectangles and document text, including while
editing. Recorded the document editor nowheel exclusion as an implementation gap;
this spec update does not change runtime behavior.

### 2026-09-19 - working tree - Navigation over document text

Removed the editor wheel exclusion so pan/pinch reaches the canvas while text
retains drag selection. Browser checks verified wheel navigation over elements and
focused text, plus text selection without card movement. Physical trackpad gestures
were not tested. All 129 tests and build pass; existing formatting and bundle-size
warnings remain.

### 2026-09-19 - working tree - Interaction modality grouping

Organized each element event table into mouse/trackpad and keyboard groups.
Disconnected-state rules remain shared across input methods. Documentation only;
behavior and verification results are unchanged.

### 2026-09-19 - working tree - Lifted elements

Cards and rectangles scale visually to 1.015 with a subtle shadow when hovered or
dragged. Reduced motion removes transitions. Browser checks verified hover entry/exit,
dragging and unchanged geometry on hover; the temporary rectangle was removed.
Updated the behavior spec with the Lifted state and focused evidence. All 129 tests
and build pass; existing generated-file formatting and bundle warnings remain.

### 2026-09-19 - working tree - Document click versus drag

Document cards defer editing until release; movement beyond 5 screen pixels starts
card dragging. Editing preserves text drag selection, padding movement and the mounted
editor. Escape or outside click exits editing. Added interaction and Lifted flow
diagrams to the spec. Four focused gesture tests and browser checks cover release,
drag, cancellation, focus, text selection and editor identity. Test movement was
restored without changing text. All 133 tests, typechecks and build pass; existing
generated-file formatting and bundle-size warnings remain.

### 2026-09-19 - working tree - Smooth element and cursor translation

Added 50ms node translation and matching collaborator selection-outline transitions,
plus 100ms collaborator cursor transitions using transforms. Reduced motion disables
interpolation; authoritative geometry and presence publishing are unchanged. Browser
checks measured in-flight and settled node positions and two-tab cursor interpolation.
A temporary stylesheet regression was fixed before final checks; test geometry was
removed. All 133 tests and build pass; existing formatting and bundle warnings remain.

### 2026-09-20 - working tree - Buffered collaborator cursor playback

Replaced cursor CSS transitions with bounded receive-time interpolation and corrected
send scheduling to count request time toward cadence. User feedback reduced the
playback buffer to 80ms and pointer cadence to 40ms; other channels remain 80ms.
Backpressure, latest-only pending data, reduced motion and stale-gap reset remain.
A local two-tab run measured 39.9ms mean arrival spacing and 37 moving frames for 16
updates, then settled at the final coordinates. All 137 tests and build pass; existing
generated-file formatting and bundle-size warnings remain.

### 2026-09-19 - working tree - Dedicated History documentation

Added a concise implementation spec in `docs/history.md`: deletion, Undo/Redo,
retries, recovery, ownership and operation coverage. Requirements target Elements;
current type-specific gaps remain explicit. Shared history has open
grouping, concurrency and retention decisions. Linked from architecture; no runtime
behavior changed.

### 2026-09-19 - working tree - Element deletion History

Extended personal deletion Undo/Redo to all current Element types. Rectangles now
retain identity, geometry and color on removal; generations reject stale writes
after restoration. A shared controller owns ordering/retries and a typed deletion
handler owns operation behavior. Local browser buttons and keyboard pass; focused
tests cover mixed ordering, capacity, credentials, retries and legacy records.
All 144 tests pass across the full run and timeout retries; build passes. The
existing generated-guidance formatting warning remains.

### 2026-09-19 - working tree - Move and resize History

Recorded move/resize gestures in shared Element History, including atomic group
Undo/Redo. Backend receipts capture starting geometry and coalesce live writes;
conditional restoration preserves later collaborator edits. No-ops are ignored,
new accepted gestures clear Redo, and automatic text growth remains separate.
Local two-client checks passed for exact geometry restoration, group Undo,
document text preservation and conflict refusal. Temporary test Elements removed.
Build and 159 tests pass across full/focused runs and timeout retries; existing
generated-guidance formatting and bundle-size warnings remain.

### 2026-09-20 - working tree - Creation History

Canvas Add actions now record Element creation after backend acceptance. Atomic
creation receipts prevent duplicate Elements on retry; Undo/Redo reuses soft
deletion and restoration, preserving identity and saved content. Browser rectangle
Add/Undo/Redo passes; both types pass backend tests. Build, architecture and types
pass; 164 tests pass across the full run and architecture timeout retry. Existing
generated-guidance formatting and bundle-size warnings remain.

### 2026-09-20 - working tree - Session-scoped Canvas History

Unified create, delete and geometry actions behind a compact History facade.
Core handlers own continuity rules; Convex adapters atomically store actions,
immutable attempt outcomes and session/Element bindings. Bounded gesture cursors,
explicit closure and idle leases handle retries and interrupted gestures.
Browser checks passed complete rectangle Undo/Redo and peer-edit conflict refusal;
a mistaken document drag was superseded by later moves and those were preserved.
All 176 tests pass with an increased timeout after two architecture fixture timeouts.
Build, types and architecture pass; generated-guidance formatting and bundle-size warnings remain.

### 2026-09-20 - working tree - Document editor recovery and focus

Reconnection preserves the current caret; new clicks still place it normally.
Confirmed synchronization clears errors, and saved-text snapshot failures no longer
claim pending edits. Selection/presence transactions reuse authorship and recovery
content. Browser and isolated-hook checks pass; all 176 tests pass across the full
run and architecture timeout retry. Build and types pass; the existing generated
guidance formatting and bundle-size warnings remain.

### 2026-09-20 - working tree - Stable document text during dragging

Separated temporary canvas interaction locks from failed document reads. Drag
settlement no longer inserts a sync warning into document cards. Browser drag and
release preserved text and editor identity; test geometry was restored with Undo.
Six projection tests pass, including lock/read-failure transitions; build passes.
The full check passed 175 tests and hit the same two architecture fixture timeouts.
