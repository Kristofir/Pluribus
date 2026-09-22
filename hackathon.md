# Hackathon log

- **Project:** ConvexHackathon
- **Event:** Convex All Gas Hackathon
- **What it does:** React workspace with Google sign-in, a collaborative canvas and documents, and revocable guest collaboration links.
- **Live app:** not deployed
- **Repo:** https://github.com/Kristofir/Pluribus
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** @convex-dev/migrations, @convex-dev/prosemirror-sync, @convex-dev/presence
- **Convex features:** auth schema and indexes, queries, auth actions and mutations, HTTP actions, realtime queries, document lifecycle and History
- **Auth:** Convex Auth
- **AI models:** gpt-4.1-mini (image descriptions; configured key required)
- **Started:** 2026-09-02T19:44:18Z
- **Last updated:** 2026-09-22T10:48:37Z

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

### 2026-09-20 - working tree - Private workspace collaboration

Added member-scoped canvases, canonical main/reply panels, stable paragraph links,
source capture revisions, reviewed send intents and revocable external MCP editing.
Convex stores atomic text/authorship evidence and checks safe agent-group Undo.
Local HTTP smoke passed initialization, editing, retry and revocation; disposable
fixtures were removed. Backend regression and editor concurrency/Undo checks pass.
Provider credentials are absent: live scrape, mailbox and real-send behavior remain
unverified. All 203 tests, architecture, type checks and build pass; source formatting
and generated-output exclusions complete the local verification.

### 2026-09-20 - working tree - Live provider integration

Workspace creation now provisions one AgentMail inbox asynchronously, using a
persisted provider identity across retries, timeout recovery and visible setup state.
The first key returned HTTP 403 `missing_permission`; after replacement, the same
persisted identity provisioned the demo inbox successfully. Its real thread-list
read passed with an empty inbox; no email was sent. Live Firecrawl main-content scraping and prompted JSON
extraction passed through the production adapter on a public page; the temporary
verification helper was removed. All 206 tests, architecture, types, formatting and
build pass. Authenticated product UI acceptance remains separate from adapter proof.

### 2026-09-21 - working tree - Retire Rectangles

Removed Rectangle creation, rendering and interaction from the active canvas.
Legacy endpoints and History inverses cannot mutate or revive stored rectangles;
old rows and receipt formats remain intact. Paragraph links omit retired targets,
and agent contexts containing rectangles require a fresh selection before reads
or edits. Document editing and History remain active.
All 197 tests, architecture checks, types, formatting and build pass. Local Convex
codegen succeeded. PM browser verification confirmed the removed creation control
and both existing documents preserved; no user content was changed.

### 2026-09-21 - working tree - Canvas minimap

Added React Flow’s built-in MiniMap with themed colors and drag-to-pan / scroll-to-zoom
navigation. Browser verification confirmed viewport changes while document geometry
and text stayed unchanged. All 197 tests, architecture, types, formatting and build
pass on rerun; the initial run hit two architecture fixture timeouts.

### 2026-09-21 - working tree - Document editor presentation

Added a persistent, grouped formatting toolbar and a centered document page in
workspace panels (`DocumentToolbar.tsx`, `DocumentPanelSession.tsx`). Existing
schema controls share the mounted editor; canvas cards remain text-only.
All 197 tests, architecture, types, formatting and build pass. Real local Tiptap
preview checks passed selection-preserving formatting, Undo/Redo, pending/read-only
controls, narrow layout and dark theme. Backend acknowledgement and panel-session
reopening were reviewed in code, not exercised by this isolated preview.

Removed the routine saving banner from rich document panels so syncing no longer
shifts the editor layout. Pending-edit guards and failure/paused notices remain.

### 2026-09-21 - working tree - Quiet document cards

Removed loading placeholders and status messages from canvas Document Cards through
an explicit card presentation. Retry/recovery controls and editor safeguards remain;
standalone document status stays visible. Updated behavior rule D1.
Build and type checks passed. Full tests encountered a backend authorship fixture
timeout; duplicate runs were stopped. Card rendering branches were verified in code;
live loading/error states were not exercised.

### 2026-09-21 - working tree - 100 canvas documents

Raised the active spatial document cap to 100 through a shared domain constant.
Creation, reads, restoration and Add controls agree; panel documents are excluded.
Boundary regressions cover card 101 rejection and a 100-card History group. Local
Convex update succeeded; browser Add control is enabled beyond the old limit.
Full check passes 197 tests on rerun after one architecture fixture timeout.
Rendering performance with 100 live editors was not measured.

### 2026-09-21 - working tree - Web Page canvas Elements

Existing Firecrawl sources now render as workspace canvas cards with URL/prompt
creation, fetching/ready/failed states, bounded previews and full read-only capture
panels. Refresh retains the previous successful capture and provenance until success.
Typed Element History handles creation, mixed geometry groups and deletion/Undo;
late provider results cannot overwrite deleted/restored content. Source capacity
remains 20, independent of 100 documents. Source selections also support paragraph
links and agent context. No duplicate collaborative text model was introduced.

PM verified the integrated local flow: a disposable public example page moved from
Fetching to Captured, opened its full capture, and retained exact titled content
through Delete/Undo/Redo. Existing user sources were untouched. Live drag/resize
was not checked; mixed geometry/Undo and lifecycle boundaries have backend tests.
DE separately verified narrow/dark presentation and retained-capture failure state.

Final full check passes 205 tests plus architecture, types and formatting; build
passes. Final local anonymous Convex codegen/update succeeded. No commit, push,
production deployment or email send occurred.

### 2026-09-21 - working tree - Multi-element canvas selection

Added Shift-click toggling, background marquee selection, Space-drag panning and
selected count on Delete selected. Mixed Document/Web Page groups reuse existing
movement and deletion; Shift-click no longer enters document editing.
All 206 tests, architecture/types/formatting checks and build pass. A disposable
React Flow fixture verified Shift toggle, marquee and group spacing with no edit
activation after dragging. Deletion keeps one Undo entry per element; pending-text
and disconnect guards were code-reviewed with focused History tests passing.
The expanded deletion browser fixture timed out, so end-to-end deletion and active
editor modifier checks remain unverified. Existing user cards were untouched.

PM subsequently verified live marquee selection and bulk deletion on two disposable
Document Cards: Delete removed both, two Undo restored them, and two Redo cleaned
them up. Existing user cards were unchanged. Active-editor modifier behavior remains
covered by code review rather than a live editing check.

### 2026-09-21 - working tree - Main document on canvas

Moved the single canonical main-document session onto fixed, centered canvas paper;
height follows content. Replies retain panels. The paper cannot enter selection,
movement, deletion or Element History. Main document frames the top at a width-based
zoom; paragraph links pan and highlight through a stylesheet outside editor content.
A disposable real-Tiptap preview verified one mount across panel toggles, growth
from 1,000 to 2,618 pixels, unchanged recenter zoom, paused controls, fixed position,
marquee exclusion and paragraph reveal without outer scrolling. Existing protocol
and recovery tests remain the sync evidence; no real user text was changed.
All 208 tests, architecture/types/formatting checks and build pass. No backend
schema changes, migrations or deployment were needed.
Paper layers above unselected cards to keep legacy overlaps from covering writing;
selected cards rise above it. Main document clears local selection before recentering.
Saved card geometry remains untouched; overlapping portions can be revealed by marquee selection.
Disposable browser assertions confirmed both layer orders after selection changes;
the final 208-test check and build pass after this adjustment.

### 2026-09-21 - working tree - Visible snapping and card spacing

Snap targets now intersect the current viewport plus a 160-screen-pixel margin,
rechecked during gestures. Added 24-canvas-pixel facing-edge spacing for overlapping
rows/columns, including groups and resizing, with numbered gap guides and Alt bypass.
Focused tests cover viewport/zoom boundaries, release, resize limits, group spacing
and guides. Full check passed (224 tests, one skipped), and build passed. Rules were
verified through code/tests; live browser snapping was not exercised in this update.

### 2026-09-21 - working tree - Page capture diagnostics

Reproduced a provider HTTP 403 for a New York Times page: Firecrawl reported the
site unsupported, while `example.com` succeeded. Capture jobs now distinguish
access refusal, credentials, credits, rate limits, timeouts and invalid responses
without exposing provider bodies. Added HTTP adapter and job recovery tests plus
an opt-in live smoke test documented in README. All 12 focused tests passed with
live smoke enabled; the regular suite skips that network-dependent test.
Full check (224 passing tests) and build passed; updated functions were applied to
the existing local anonymous backend. This does not enable unsupported sites.

### 2026-09-21 - working tree - Keyboard canvas History

Removed canvas Undo/Redo buttons and their empty row. Existing keyboard shortcuts
remain; History errors and Retry action appear only when needed. Updated behavior
spec; document formatting toolbar is unchanged.

### 2026-09-21 - working tree - Canvas creation menu

Replaced toolbar Add document, Add web page and Delete selected controls with a
background right-click creation menu. Creation captures the clicked canvas position,
including across the Web Page URL form; keyboard deletion remains. Space/middle-drag
pan, Shift+F10 opens the menu for focused canvas, and access/capacity guards remain.
Browser checks on the real menu with disposable callbacks passed both actions,
keyboard navigation, Escape and outside dismissal. Full check passed (225 tests,
one skipped) and build passed. Existing user cards were not changed.

### 2026-09-21 - working tree - Canvas context-menu suppression

Suppressed native browser context menus in the canvas subtree, including cards
and paper, and explicitly in the portaled creation menu. Capture handlers prevent
the browser default without stopping the background creation-menu handler.

### 2026-09-21 - working tree - Remove canvas header

Removed the canvas header containing Home, Shared canvas, Theme and interaction
hints, together with its unused styles. Workspace navigation remains above the
canvas; context-menu creation and keyboard controls remain available.

### 2026-09-21 - working tree - Hide alignment guides

Removed the canvas alignment/spacing guide overlay. Snap geometry, spacing and
Alt bypass remain active; behavior spec now explicitly forbids visible guidelines.

### 2026-09-22 - working tree - Web Page capture recovery

Added revision-scoped capture deadlines/recovery, coalesced active refreshes and
explicit replacement conflicts. Incomplete provider output retains the last good
capture; repeated failed refreshes preserve unprompted provenance. Added the API
handoff in `docs/web-page-api.md`. Source-focused tests pass (37, one live test
skipped); build, types, architecture check and formatting pass. Default full check
hit existing fixture timeouts; a two-worker run passed 239 tests with one architecture
timeout, and all 25 architecture fixtures passed separately with a 15-second bound.
No UI changes, provider requests or deployment were performed for this work.

### 2026-09-22 - working tree - Web Page card redesign

Moved canvas URL/instructions entry into a local card at the creation point; Fetch
uses the existing shared source/History operation. Added Paper MeshGradient for
fetching and compact Web Content/title/URL/body output without footer controls.
Shader motion respects reduced motion and pauses offscreen/hidden; refresh and
context controls remain in the full panel. New cards are 300×176 with a 300×132
minimum; existing saved geometry is retained. Disposable browser checks covered
input, fetching shader, content and failure recovery. Full check passed (240 tests,
one skipped); build passed. Live authenticated capture creation was not checked.

### 2026-09-22 - working tree - Web Page recovery API integration

Cards retain successful content during refresh/failure, including exact capture
URL and absent-prompt provenance. Panel refresh/retry sends expectedRevision;
conflicts ask for review/waiting without replacing newer work. Explicit Stop waiting
recovers legacy or overdue busy requests without automatically fetching again.
Mock browser checks passed retained content, manual recovery, separate Retry and
revision-conflict feedback; three frontend tests cover provenance/recovery/errors.
Full check: 241 passed, two architecture fixture timeouts, one live test skipped.
Architecture fixture rerun passed all 25 with a 15-second per-test bound. No backend
edits, deployment, provider calls or Git publication in this integration.

### 2026-09-22 - working tree - Structured capture rendering

Added modular safe Markdown/GFM, CSV and JSON-record rendering in the existing
Web Page presentation. Full panel retains both captured text and extraction with
unchanged originals; explicit format selection handles ambiguous all-text CSV.
Empty results differ from parse failures; nested JSON stays raw, HTML is skipped,
and truncated card previews are never treated as complete structured responses.
Twelve parser/render regressions pass; PM independently reran them and accepted
mixed, empty, malformed, original-response and CSV-override browser states.
Full check passed (255 tests, one skipped), build and diff checks passed. Existing
large-chunk build warning remains. No backend edits, provider calls or deployment.

### 2026-09-22 - working tree - Explicit table extraction contract

Separated extraction intent from display format. Source requests and History creation
accept named columns; the provider receives an explicit rows schema. Backend rejects
instruction metadata, mismatched columns and invalid cells without replacing prior
captures. Table settings participate in request coalescing and successful-capture
provenance; format-only prompts receive guidance before enqueue. Shared core input
helpers serve frontend/backend validation. Plain capture and general JSON remain
compatible. Handoff: docs/web-page-api.md.

Integrated tests passed (282, one live-provider test skipped), as did architecture,
types and build; one test formatting issue was corrected afterward. Backend W1/W2
input/recovery behavior is covered by mocked tests. No live provider calls, deployment,
or stored-capture changes were made; factual extraction quality remains unverified.

### 2026-09-22 - working tree - Table intent and compact previews

Canvas creation and the existing source edit form now separate extraction content
from Content/Table choice and user-named columns. Shared validation blocks format-only
instructions before submission. Full tables use capture-owned schema/order; compact
cards summarize captured columns, omit noisy layout/navigation previews and fall back
to Open capture without claiming absent data. Originals and saved captures remain intact.
PM accepted mock intent rejection, table payload, stored column order and neutral fallback.
Seventeen focused frontend tests passed; integrated suite passed 282 tests/one skipped,
architecture/types/build passed. One backend formatting issue was corrected separately.
No provider calls, deployment or Git publication; actual extraction quality unverified.

### 2026-09-22 - working tree - Instruction-only extraction

Supersedes the separate shape/columns controls above. Users provide URL and optional
instructions; one schema-driven provider request infers text or table and its columns,
with explicit names in the instructions passed through. Format-only instructions ask
for relevant page records instead of being blocked. A versioned, locally validated
output envelope rejects instruction metadata and malformed rows while preserving the
previous capture. Legacy JSON and explicit-table captures remain readable. Request
revisions, deadlines, coalescing and provenance are preserved; docs/web-page-api.md
records the contract and inference limits.

Backend/core focused tests passed 75/75 (one live test skipped). The shared full check
passed architecture, types, formatting and 301 tests (one skipped); build passed with
the existing large canvas bundle warning. PM reported independent mocked browser
acceptance of URL/instructions-only payload and inferred mixed text/table rendering.
No live provider calls, deployment, Git actions or stored-capture changes were made.
Tests prove output shape and recovery, not real-world extraction accuracy.

### 2026-09-22 - working tree - Above-fold page screenshots

The same scrape now requests a 1280×800 viewport screenshot with fullPage false.
Provider URLs expire, so bounded PNG/JPEG downloads are copied into Convex storage;
authenticated reads resolve capture-owned image URLs. Image-only failure keeps usable
text with a warning. Failed refresh retains the prior capture/image. Pending uploads
are cleaned up, while accepted files remain for immutable context snapshots and Undo.
The API handoff documents host/type/size/time limits and the unregistered-orphan crash
window; no general retention framework was added.

DE added card/panel images and graceful unavailable-image handling without geometry
writes. PM reported mocked browser acceptance of compact/medium/tall cards, full panel
and broken-image fallback. Eleven frontend and thirteen screenshot-backend focused
tests passed. Final full check passed 317 tests (one live test skipped), architecture,
types and formatting; build passed with the existing large canvas chunk warning.
No live paid provider calls, deployment or Git actions. Actual provider CDN/image
compatibility remains unverified live; backend image tests use mocked raster headers.

### 2026-09-22T03:58:08Z — working tree

Web Page Card snapshots now stack above text at every card size. Updated W7;
browser geometry checks passed for compact, medium, tall and unavailable-image fixtures.

Preview areas also match the stored screenshot’s 8:5 ratio; browser measurements
confirmed 268 × 167.5 at all fixture sizes. Build passed. Full tests had three
architecture timeouts; all 25 architecture tests passed separately with a 20s timeout.

Corrected the stacked preview to a non-shrinking flex column so the full-ratio
image reserves layout space before the text, including in short cards.

### 2026-09-22T04:19:10Z — working tree

Web Page Cards now measure their content and grow through the existing canvas
geometry path, with content-height resize minimums and no internal scrolling.
Browser fixtures grew short cards to320px without overflow; taller cards stayed taller.
Full check and build passed.

### 2026-09-22T04:21:30Z — working tree

Web Page Card height transitions use180ms ease-out, with direct manual resize
and reduced-motion support. Browser fixture measured320px,397px,440px during
the transition. Full check and build passed.

### 2026-09-22T04:25:55Z — working tree

Web Page Cards expose one Details button to open the capture sheet in all states.
Titles and snapshots no longer open it. Browser fixtures and regression tests verify
the single control; canvas behavior spec updated.

### 2026-09-22T04:52:20Z — working tree

Removed selected-element boundary lines and group boxes while preserving resize
hit targets. Document cards now start at300px wide and use a300px resize minimum,
matching Web Page cards. Existing saved widths are preserved.

### 2026-09-22T04:54:24Z — working tree

Hidden all resize-control visuals, including corner handles, and removed the
document focus border color. Browser fixture confirms zero control opacity and
identical focused/unfocused border colors; invisible resize targets remain usable.

### 2026-09-22 - working tree - OpenAI text-generation port

Added a dependency-free TextGeneration application port and backend OpenAI Responses
adapter. Callers choose model, text/instructions and output budget. The adapter reads
a backend environment secret, bounds time/response size, reports incomplete/refused
output and usage, and sanitizes provider failures without automatic retries. No
frontend endpoint, conversation persistence or product usage was enabled.

Mocked provider/regression lane passed 49 tests (one live Firecrawl test skipped).
Full check passed 333 tests (one skipped), architecture, types and formatting; build
passed with the existing canvas bundle warning. No live OpenAI request, model access
verification, deployment or Git action was performed.

### 2026-09-22T05:50:47Z — working tree

Dragged cards show dashed outlines at resolved snap destinations, including groups.
Outlines clear with gesture cleanup or bypass and ignore pointer input. A local
React Flow fixture verified rendering and clearing. Full check is blocked by
concurrent presence API type mismatches; the owner was notified.

### 2026-09-22T05:52:02Z — working tree

Restricted snap destination outlines to spacing matches next to another element.
Ordinary edge/center alignment no longer shows an outline;7 focused snap tests pass.

### 2026-09-22T05:54:41Z — working tree

Spacing previews now appear as soft destination shadows within24 screen pixels,
before the actual6px snap threshold. Preview resolution does not alter geometry;
8 focused tests cover zoom, approach, bypass and leaving range.

### 2026-09-22T05:56:30Z — working tree

Moved the snap destination shadow beneath the canvas card layer.

### 2026-09-22T05:57:49Z — working tree

Expanded the application MCP with read-only canvas layout and saved Web Page
content tools. New grants explicitly allow workspace-wide canvas reads; older
document-only grants keep their scope, and document text edits remain limited to
granted IDs. HTTP tests cover cross-workspace, removed-source and grant denial.
Full check passed 347 tests (one skipped), and the frontend build passed. No
deployment or Git action was performed.

### 2026-09-22T05:59:00Z — working tree — Browser Presence ownership

Presence follows the newest focused eligible tab in a browser profile. Web Locks
serialize claims; Convex account-bound epochs fence previous owners and retire old
context activity. Followers only read; legacy clients must reload. Failed activity
retries its sequence with capped backoff, and newer state supersedes it.

Focused Presence/access tests passed40; full tests passed347 with one live-provider
skip. Architecture/types and build passed; changed Presence files pass formatting.
Full formatting was blocked by concurrent MCP edits. The disposable browser focus/handoff fixture timed out; real-browser behavior
remains unverified. No deployment, provider call or Git action.

### 2026-09-22T06:01:06Z — working tree

Selected-element context menus offer Delete, or Delete All and an Arrange submenu.
Grid/horizontal/vertical placement preserves card sizes with24px spacing and uses
one History geometry gesture. Added arrangement regressions and keyboard menu access.
Full check350tests passed/one skipped; build passed.

### 2026-09-22T06:29:55Z — working tree — Canvas image uploads

Workspace members can drop PNG, JPEG, GIF or WebP files onto the canvas or choose them from its creation menu. Local preview cards show upload progress and Retry/Remove on failure. Upload intents validate size/type before personal Element History creates a shared image card; move, resize, delete and Undo retain its storage file. Expired unclaimed registered files are cleaned up (`canvas/Images.ts`, `CanvasPage.tsx`, `UseImageUploads.ts`).

Image backend/projection tests passed. Full check passed: 356 tests with one live-provider test skipped, architecture/types/formatting clean; root build passed. The browser displayed the Image card creation choice, but file upload through the automated browser was not verified.

### 2026-09-22T06:33:38Z — working tree

Added Arrange → Masonry: shortest-column placement preserves card sizes and24px
gaps, with column widths derived from assigned cards. Regression covers unequal
heights/widths and deterministic placement; browser menu dispatch, check and build pass.

### 2026-09-22T06:33:50Z — working tree — Agent identity and Presence

New external MCP grants cover one workspace; existing narrow grants stay narrow.
Each grant now keeps one agent author for accepted edits. Authenticated MCP
requests renew a 30-second activity lease shown as recently active; expiry and
revocation remove it. Context snapshots remain optional starting material.

Focused backend/frontend tests passed for identity, scope, expiry and roster text.
Full check passed 358 tests (one live-provider test skipped), including architecture,
types and formatting; frontend build passed. No live agent connection or deployment
was used.

### 2026-09-22T06:47:39Z — working tree — Canvas URL imports

Private workspace members can drop a browser image/link or choose Import URL from the canvas menu. A checked image is stored as an Image card; an HTML/text page enters the existing Firecrawl Web Page path. Temporary drafts show checking, creation, retry and removal. The image fetch pins a public IPv4 address, rejects redirects and limits size (`CanvasUrlImport.ts`, `UseUrlImports.ts`).

Focused import policy, image History and drag-payload tests passed. Full check passed 363 tests with one live-provider test skipped; build passed. A live import was not verified: local Convex codegen could not configure Node actions because the current Node runtime is unsupported. No provider request, Git action or deployment completed.

### 2026-09-22T07:03:49Z — working tree — MCP URL in workspace header

The Workspace header has a Copy MCP URL button before grant creation. Local
loopback URLs are labeled local-only, and the agent controls explain that remote
agents need an HTTPS deployment. The bearer token selects the workspace; the URL
alone does not authorize access. Full check passed 363 tests with one live-provider
test skipped, and the frontend build passed. No deployment or Git action occurred.

### 2026-09-22T07:15:14Z — working tree

Unified document, web page and image card shells in shared CanvasCard styles:
16px padding/corners, neutral border, theme surface, body/metadata typography and
hover/drag lift. Screenshot auto-height includes borders. Browser computed-style
comparison matches all three shells; full check363tests/one skip and build passed.

### 2026-09-22T07:18:12Z — working tree — Agent connection entry point

The Workspace action now opens the agent setup controls instead of copying the
MCP URL alone. The controls explain the bearer requirement, show connection
details beside grant and revocation, offer a copy action, and suggest a
`read_canvas` check. Full check passed 363 tests with one skipped; build passed.
The authenticated MCP read still awaits a temporary workspace grant.

### 2026-09-22T07:18:58Z — working tree

Collaborator activity stays visible; removed the display toggle. Presence uses
32px colored initials with8px overlap, accessible identity/status labels and hover
titles; agents remain labeled recently active. Browser fixture, check and build pass.

### 2026-09-22T07:22:02Z — working tree

Moved presence avatars into a top-left canvas overlay outside viewport transforms.
The roster no longer consumes a layout row; only avatar/status content captures pointers.

### 2026-09-22T07:26:04Z — working tree — Image URL import repair

Corrected the public IPv4 check so a valid image host in `192.0.77.*` is allowed while reserved `192.0.0.*` and documentation `192.0.2.*` ranges remain blocked. The local Convex backend now runs with Node 24 and exposes the URL import action. An image URL imported through the canvas menu produced a visible Image Card that survived reload (`UrlImportPolicy.ts`, `CanvasUrlImport.ts`, `UseUrlImports.ts`). Full check and build passed.

### 2026-09-22T07:27:02Z — working tree

Image cards now show edge-to-edge images with no filename caption, padding or border.
Cover sizing preserves image proportions; accessible names and draft recovery overlays remain.

### 2026-09-22T07:30:17Z — working tree — Temporary image loading delay

For demo testing, successful local-file and URL image imports keep their loading draft visible for at least three seconds before creating the shared Image Card. Transfers still run normally and failures appear immediately (`ImageLoadingDelay.ts`, `UseImageUploads.ts`, `UseUrlImports.ts`). Full check and frontend build passed.

### 2026-09-22T07:33:13Z — working tree

Image click opens a native modal lightbox with a240ms card-to-viewport animation
and reverse close. Drag/Shift-click do not open it; Escape/backdrop/close dismiss,
focus returns to the card, and reduced motion bypasses animation. Check/build passed.

### 2026-09-22T07:35:52Z — working tree — Image drop transition

Removed the full-canvas dashed drop overlay that appeared before an image or link draft. Drag-over still sets the copy cursor; dropping creates the local loading draft directly (`CanvasPage.tsx`, `Canvas.css`). Full check and frontend build passed.

### 2026-09-22T07:47:42Z — working tree — Image card proportions

New file-upload and image-URL cards use decoded source dimensions for their initial canvas size instead of a fixed rectangle. Extreme ratios remain within canvas geometry limits, and existing cards retain saved dimensions (`ImageCardSize.ts`, `UseImageUploads.ts`, `UseUrlImports.ts`, `UseCanvasCommands.ts`). Size tests and full check passed (365 tests, one skipped); frontend build passed. No new workspace image was created for visual verification.

### 2026-09-22T08:48:29Z — working tree — MCP card actions

Workspace agents can create Document and Web Page cards, set geometry and delete
Document, Web Page and Image cards, and conditionally reverse their actions.
Grant-bound Element History preserves retry, capacity and lifecycle rules; a
geometry change also checks the card position last read by the agent. Canvas
reads now list Images (`agentAccess/CanvasActions.ts`, `Mcp.ts`). Architecture,
type checks and 366 tests passed with one skipped; build and changed-file format
checks passed. The full formatting gate currently flags two concurrently edited
workspace layout files outside this change. The running local MCP exposed the
final geometry schema with `expectedGeometry`; live card writes were not attempted.

### 2026-09-22T08:50:27Z — working tree

Cards fade/rise in on mount. Workspace-local viewport center/zoom restores across
reload and window sizes, with default framing on missing/invalid storage. Browser
fixture restored pan/zoom;2 persistence tests passed. Full tests366 passed/one skip;
validation blocked by concurrent workspace formatting and missing SharedWorkspace.css.

### 2026-09-22T08:53:59Z — working tree — Revocable guest workspace links

Members can create, rotate and revoke one link per workspace. The raw secret
appears only on creation; Convex stores its hash. Opening the link starts an
anonymous Auth session, redeems a share-derived membership, and opens the normal
workspace with canvas, document, inbox and agent controls. Every workspace
request checks that the underlying link remains active; the workspace route
also hides retained content when access ends. Guests do not acquire admin rights.
Focused tests cover admission, normal canvas/document/inbox/agent access,
rotation, revocation and admin denial (`ShareLinks.ts`, `ShareJoinRoute.tsx`).
Claiming a verified direct assignment upgrades a share-derived membership so
link revocation cannot remove independently assigned access.
Full check passed (370 tests, one skipped), build passed, and functions were
pushed to the local Convex backend. The live guest-link journey was not checked
in a browser; no active share link was created for that check.

### 2026-09-22T08:55:08Z — working tree

Changed card entrance to a280ms scale pop:88% to102.5%, settling at100%.
Reduced motion skips the animation; hover transforms remain independent.

### 2026-09-22T08:57:05Z — working tree

Card pop-in animations use a random0–180ms delay, sampled once per mount through
a shared hook. Position/content rerenders keep their delay; reduced motion skips animation.

### 2026-09-22T09:01:12Z — working tree

Slowed the card entrance pop from280ms to450ms, retaining random delays and reduced-motion support.

### 2026-09-22T09:06:27Z — working tree

Drag release commits the last visible snap-shadow destination through the existing
History gesture and snap animation. Bypass discards the target; regression covers
exact preview landing, one-time consumption and bypass.

### 2026-09-22T09:10:25Z — working tree

Snap shadows now fade/scale in and out over140ms with retained exit visuals.
Reduced motion skips the transition. Full check and build passed.

### 2026-09-22T09:15:34Z — working tree

Removed the image lightbox close button. Escape and backdrop click still close it;
local browser checks passed, with 370 tests passed/one skipped and build passing.

### 2026-09-22T09:31:42Z — working tree

Rebuilt the signed-out home page with a minimal dark hero, Google login CTA and
a real canvas preview. Existing Google login returned to the workspace dashboard;
desktop/mobile and keyboard checks passed. Full check: 370 tests passed, one skipped;
build passed. Copy remains provisional.

### 2026-09-22T09:35:43Z — working tree

Removed the fixed main-document editor from React Flow and restored its single
canonical session to the workspace side panel. Main document and paragraph links
open that panel; card geometry and document content are unchanged. The agent
canvas read returns its document ID separately, without a paper element. Local
workspace browser review passed; full check passed 368 tests/one skipped and build
passed. The MCP change was pushed to the local-anonymous Convex backend only.

### 2026-09-22T09:42:40Z — working tree

The signed-out landing now embeds the existing anonymous shared canvas instead
of a static capture. Live reads and a disposable create/delete cycle worked
without sign-in; edits are visibly labeled public. The landing and full canvas
keep separate saved views. Full check passed 368 tests/one skipped; build passed.

### 2026-09-22T09:52:43Z — working tree

The signed-out live canvas now shows all active card types. Shared Document cards
remain editable; local Image and Web Page examples open in their viewers without
granting anonymous uploads or page capture. Browser interaction checks passed.
Full check passed 368 tests/one skipped, and build passed.

### 2026-09-22T09:54:13Z — working tree

Canvas participant initials and agent markers now use the shared Avatar component,
with a fixed circular size and overlap. Live workspace preview showed the corrected
circle; full check passed 368 tests/one skipped and build passed.

### 2026-09-22T10:05:18Z — working tree

The signed-out landing now uses a separate session-only canvas with a curated
Carol message, Image, and Web Page. Visitors can edit, move, resize, remove, and
add local notes without reading or changing the public canvas. A browser check
showed edits survive reload in one tab while a new tab starts clean. Full check
passed 368 tests/one skipped, and build passed.

### 2026-09-22T10:05:32Z — working tree

Selected rich text now shows a floating link, bold, italic and style menu in
document cards and panel editors. The shared schema accepts safe web links.
Browser checks covered selection, dismissal and link entry; full check passed
368 tests/one skipped, and build passed.

### 2026-09-22T10:21:47Z — working tree

The landing demo now mounts the real Canvas against one private Convex workspace
per anonymous guest. It seeds the Carol document and captures the specified
Gatorade product page through the existing Web Page job; the image remains a
local illustration. The local browser showed the fetched page title, text and
screenshot, and Document creation plus Undo worked. Backend access checks block
other visitors and stale sharing or agent grants. The production build passed;
65 test files passed (369 tests, one skipped).

### 2026-09-22T10:28:14Z — working tree

Reloading the landing page now resets the anonymous guest canvas to the Carol
note and original card layout. The backend retires added cards, restores edited
text through ProseMirror Sync, and reuses the Gatorade capture; the frontend
clears the saved viewport. A browser edit disappeared after reload while the
captured page remained. Full check passed 370 tests/one skipped, and build passed.

### 2026-09-22T10:40:42Z — working tree

Simplified canvas creation and Web Page details, started Note cards square,
and moved Share into a compact popover with one reusable guest URL. Retired the
main document from new workspaces and navigation while retaining old data and
reply editors. Image uploads and imported image URLs now schedule a best-effort
AI description after card creation. Local Convex codegen synced the backend;
full check passed 370 tests/one skipped and build passed. Live AI description
was not verified because the local backend has no model key configured.

### 2026-09-22T10:48:37Z — working tree

Canvas Note cards now color collaborators' attributed text and show a resolved
author label on hover. The current viewer's own text and unattributed legacy
text remain neutral; the effect does not alter synced document content. A
focused authorship test and full check passed (371 tests, one skipped); the
frontend build passed. Browser appearance was not checked in this run.
