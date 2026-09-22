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

## Canvas feature architecture

- **Status:** Accepted; supersedes the P00 implementation exception
- **Date:** 2026-09-15
- **Decision:** Develop the shared canvas as a regular feature at `/canvas`, using
  React Flow, the existing Convex backend, and the `@pluribus/core` workspace.
  Follow the existing core/use-case/adapter boundaries and feature-scoped Zustand.
- **Why:** The user requires strict architectural compliance and intends to expand
  this feature. An experiment identifier must not define runtime ownership.
- **Boundary:** The core owns rectangle rules and use cases; transaction-bound
  Convex adapters own persistence and server-derived actor classification. The
  explicit current policy permits anonymous and signed-in participants. This is
  not permission to bypass future workspace authorization. Zustand owns transient
  interaction state; Convex owns durable rectangles. No new Canvas, Workspace, or
  Membership models are introduced by this refactor.
- **Compatibility:** The former prototype URL redirects to `/canvas`. The two
  local legacy rectangles were migrated to `rectangles` with their geometry and
  colors verified unchanged. Record IDs changed; no routes reference them. The
  one-time migration and empty legacy schema were retired after verification.
  The official migrations component remains installed for subsequent migrations.
- **Behavior:** Latest accepted geometry wins; updates cannot recreate deleted
  rectangles. Existing capacity and geometry limits remain in the core. Long-term
  canvas interaction and conflict policies remain subject to product evaluation.

## Explicit Convex public API entrypoints

- **Status:** Accepted
- **Date:** 2026-09-15
- **Decision:** Declare each feature's public queries, mutations, and actions in
  one named entrypoint. Canvas uses `apps/backend/convex/Canvas.ts`; ordinary
  handlers and adapters remain in `canvas/`.
- **Why:** Keep client-callable operations easy to audit while retaining native
  Convex subscriptions and generated types.
- **Boundary:** Convex still derives names from files and exports. The architecture
  check enforces an explicit entrypoint allowlist, including aliases and re-exports;
  this does not introduce custom HTTP routes or move business rules out of core.

## 2026-09-15 — Standalone collaborative text

Accepted for implementation: Tiptap with Convex ProseMirror Sync, using incremental
steps and periodic snapshots. Document identity/access/initialization live in core;
editor schema and sync protocol remain adapter responsibilities. Explicit public
endpoints validate submissions instead of exporting the component's API factory.
Start with one anonymous shared document, independent of canvas. Range deletion
can remove a concurrent insertion inside that range; convergence is not a promise
to preserve every competing intention. Anchors and canvas embedding remain separate
experiments, and changing editor schemas requires a content migration.

## 2026-09-16 — Shared presence

Accepted: official Convex Presence owns session liveness; application participation
and independently sequenced activity channels serve canvas and documents. Core
owns activity validation/ordering; adapters own component integration and editor
mapping. Explicit reference-counted context leases separate participation from
surface mounts. Anonymous guest identity is presentation, not authorization.
Text cursors remain decorations mapped through the existing ProseMirror protocol;
ambiguous ranges hide. No second text synchronization engine or workspace model.

## 2026-09-16 — Documents belong to canvases

Accepted: a document is a child canvas element, with position, size, and
collaborative text inside it. Canvas synchronization handles geometry; ProseMirror
Sync handles text. This supersedes the proposed independently placed document
model. Separate storage does not change ownership. Cross-canvas document reuse
is outside this model; deletion and recovery rules remain open. The standalone
document prototype remains an implementation test surface; embedding is not built.

## 2026-09-16 — Two embedded document children

Accepted by Chris: embed up to two document children in the shared canvas, including
retained removed children in the limit. Preserve rectangle data and the standalone
document surface. Create child geometry and text atomically through owning-feature
interfaces; text operations inherit canvas access. Keep editors mounted offscreen.
Removal is reversible, retains confirmed content, and invalidates the old generation.
Pending local edits block local removal; remote removal keeps a memory-only recovery
copy with explicit discard/open-restored actions. No automatic replay after restore,
permanent deletion, cross-canvas reuse, workspace model, or new sync protocol.

## 2026-09-16 — Presence events and centralized policy

Accepted: canvas, editor and browser integrations emit facts rather than decide
when to clear activity. A pure core transition derives local activity and membership
intent; the existing registry/queue execute effects. Blur preserves activity.
Hidden tabs stop heartbeats and retain last accepted activity until component expiry;
return/reconnect starts fresh participation. Surface release still clears its owned
channels, and unsafe text ranges still hide. No new synchronization service.

## 2026-09-16 — Current-text authorship

Accepted for implementation: show authorship of surviving text using contiguous
ProseMirror marks referencing stable author records. This is separate from source
connections, ephemeral presence and a user-facing revision-history product.
Legacy unmarked text remains unknown. Typing, replacement and ordinary paste
belong to the writer; formatting preserves attribution. Explicit same-document
moves and verified undo/redo preserve original attribution.

The server derives the writer from authentication or a durable guest capability;
a guest credential identifies its holder, not a verified person. Client IDs and
client-supplied marks are not proof. Accepted steps, attribution and operation
evidence commit atomically. Rejected or merely pending local edits create no
durable shared history. Preserve native acknowledgement/rebasing and never silently
rewrite accepted steps.

Reuse canonical sync history with the minimum additional restoration evidence.
Retain that evidence during the prototype, measuring its growth separately from
current text; no automatic expiry, permanent-history product or unlimited undo is
promised. Generation changes invalidate old pending operations and session undo,
without erasing saved authorship. The prototype must prove forgery rejection,
convergence and restore semantics before these become production guarantees.

The shared `packages/editor` adapter owns the matching ProseMirror schema and
authored-step wrapper; the core remains dependency-free. Stable operation IDs
survive mapping, inversions reference their accepted operation, and step merging
is disabled to preserve receipts. Restore validation maps recorded inverses through
canonical steps. Explicit moves require saved state and a verifiable removal/
insertion pair. Canonical component snapshots provide checkpoints; no parallel
editable document table is introduced. Architecture checks must enforce this
technology-specific package boundary.

## 2026-09-17 — Canvas owns document editing

Canvas is the sole product editing surface. Retire the standalone page and redirect
`/document` bookmarks to `/canvas`. Keep the editor, schema, authorship and sync
adapters reusable. Each card opens a generation-scoped author session; concurrent
mounts share guest identity. Removal retains accepted attribution and local recovery;
restoration starts a fresh session without reviving old pending steps or undo proof.
Existing standalone stored text is retained, with no automatic content migration.

## 2026-09-17 — Shared element types

Accepted and implemented a base interface for spatial identity, canvas ownership,
and geometry. `DocumentElement` and `RectangleElement` extend it with required,
kind-specific fields; `CanvasElement` is their discriminated union. Core ports and
frontend projection code consume these types, and branded element IDs remain
separate from text-content IDs. `DocumentElementId` replaces the vague `ChildId`.

Keep plain functions for operations. Shared structure does not impose shared
removal semantics or a table migration: rectangles still delete and documents
retain their existing reversible removal. A document remains one user-managed
canvas element with internal text storage. The current canvas ID remains shared.

## 2026-09-17 — Geometry rules and explicit mutation routing

Document and rectangle use cases share `assertElementGeometry` and the same bounds.
Rectangle capacity remains kind-specific. The frontend captures a typed geometry
target for each gesture, dispatches by kind, and carries the original document
generation through queued writes. Stale targets cannot silently switch kind or
adopt a restored generation. Existing storage and removal behavior are unchanged.

## 2026-09-17 — Application operations and cohesive frontend controllers

Keep business coordination in plain core application functions with explicit ports.
Standardize canvas document operations with rectangle use cases and move document
endpoint implementations into canvas handlers. Authorship acceptance now owns
receipt uniqueness, restoration authorization, complete-move restoration and evidence
recording through transaction-bound ports. ProseMirror interprets opaque inverse
proofs, validates steps/moves and maps canonical history; sync remains an adapter.

Separate canvas commands/projection from subscription and gesture coordination,
and editor lifecycle from rendering. Preserve editor identity, pending edits and
presence leases. Keep native reads, routine sync and official presence lifecycle
in adapters: forwarding services would add no business responsibility. No schema,
public API, synchronization, retention or product behavior change is intended.

## 2026-09-18: Personal document-deletion Undo

See [History](history.md) for the current implementation and proposed extensions.

Delete removes the child from the active canvas. Personal session history owns Undo
and Redo; trusted backend receipts and retained canonical content authorize recovery.
No ten-minute countdown, removed-card placeholder, universal undo framework, or version
history. Undo advances generation; old editor capabilities stay invalid. Redo is a new
deletion of the restored child, including intervening accepted edits. Active capacity
is two; capacity rejection preserves the undo entry. Each deleted document is one entry.

Pending local text moves to app-lifetime memory before editor unmount, survives route
navigation, and is never automatically replayed. History is canvas-session-only; local
recovery clears on reload/account change. Backend retention has no automatic purge yet;
cleanup policy is deliberately separate from personal history availability.

### 2026-09-18 — Content-sized document height

Document cards use rendered text plus padding as their minimum height, grow when
content no longer fits, and preserve extra height chosen by the user. Document
height has no fixed upper cap; finite-value, width and coordinate validation
remain. Browser layout owns text measurement; geometry continues through the
existing generation-checked canvas write path. Rectangle limits are unchanged.

### 2026-09-19 — Magnetic alignment

Keep one persisted element geometry. Core resolves edge and center alignment from
geometry and explicit constraints; frontend owns gesture candidates, frozen targets,
6px acquisition/10px release thresholds, Alt bypass and guides. Group movement uses
one bounds correction; resizing changes moving edges and respects content minimums.
Existing throttled writes persist resolved geometry and flush on release.

## 2026-09-19: Element deletion History

Accepted: use one personal History controller for all Element types. Keep request
preparation, inverse operations and conflict interpretation in operation handlers;
keep stack ordering and exact-request retry in the controller.

Document and rectangle deletion share application policy and atomic receipts.
Rectangle records now retain identity, geometry and color while removed; lifecycle
generations reject old geometry writes after restoration. Optional storage fields
preserve legacy rows without a backfill. Each selected Element produces one entry;
partial failure stops the batch and preserves accepted entries. Create/move/resize
history and grouped transactions remain future work. See [History](history.md).

## 2026-09-19: Move and resize History

Accepted: one entry per gesture, including multi-Element drags. Preserve live sync
with one coalesced batch in flight; capture the starting geometry server-side.
Undo/Redo is conditional on matching geometry and lifecycle generation for every
member, and changes the group atomically. Conflicts retire the entry instead of
reversing displacement across another participant's edits. A no-op adds no entry;
a new accepted geometry action clears Redo. Automatic content-height growth stays
outside History. Interrupted gestures seal only their last submitted geometry.

## Element creation History

Accepted: creation uses an atomic idempotency receipt; Undo and Redo reuse Element
soft deletion and restoration. Redo preserves saved content and identity rather
than recreating initial content. Personal ordering stays in the shared controller.

## Session-scoped Canvas History protocol

Accepted: keep a compact personal History facade over typed creation, deletion and
geometry handlers. V2 separates immutable durable attempt results from current action
state and reversibility. Session/Element lineage permits verified personal lifecycle
Undo without reviving stale editor generations. Fixed gesture generations, explicit
close, a latest-ACK cursor and idle leases protect interrupted live movement.

Use four indexed records for distinct responsibilities: session authority, action
state, durable attempt deduplication and per-Element continuity. Preserve legacy
receipts separately. No event-sourcing framework, runtime handler registry, persistent
personal stacks, property-specific conflict engine or automatic purge in this increment.

## 2026-09-20 — Workspace prototype boundaries

Accepted for the local prototype: reuse Canvas-owned documents for main/reply
panels, distinguished by role rather than fake geometry. Keep canonical text in
ProseMirror Sync. Add paragraph IDs as editor attributes, not a second content model.

Membership and revocable document grants protect private workspaces. External MCP
clients supply typed exact-version edits; the app does not choose an AI model.
Provider actions consume revisioned source requests or immutable reviewed send
intents. Unknown delivery blocks resending until positive evidence resolves it.
These remain bounded experiments; pagination expansion, evidence retention and
broader structural Undo need separate decisions. [Details](workspaces.md).

Canvas and Web Page MCP reads use an explicit optional workspace-wide read scope.
Older document-only grants do not inherit it. Document text access and edits stay
limited to each grant's document IDs; the new tools do not mutate the canvas.

Later demo decision: new MCP grants cover one workspace, including its future
documents and saved Web Pages. Existing narrow grants remain narrow. Each grant
owns one lasting agent author ID; historical operation evidence is preserved.
Authenticated MCP requests renew a 30-second activity lease, shown as “recently
active,” with no browser session or implied persistent connection. Revocation
ends access and Presence together.

## 2026-09-22 — Agent card operations through Element History

Workspace-wide MCP grants may create document and Web Page cards and change or
delete spatial document, Web Page and Image cards. A grant gets a private History
session, so exact retries and conditional inverses use the same core rules as
browser card actions. The adapter rechecks the grant and issuer membership on
each write; old narrow grants do not acquire canvas writes. Web Page creation
uses the existing capture request with the grant issuer as the member. Image
creation remains with the upload flow; main and reply documents are not spatial targets.

## 2026-09-22 — Main document returns to the workspace panel

Remove the fixed React Flow paper presentation. The canonical main document stays
in its existing document record and ProseMirror Sync session, mounted in the side
panel like replies. Canvas cards and saved geometry are unchanged. `read_canvas`
keeps the main document ID as a separate reference, without inventing a spatial
element; `read_document` still provides its content to authorized agents.

## 2026-09-22 — Retire the main document feature

New workspaces no longer provision a main document, and the workspace open and
MCP canvas reads no longer expose one. Existing main document records and text
remain stored for compatibility; reply documents and spatial Note cards retain
their editors and access rules.

## 2026-09-22 — Revocable anonymous workspace membership

Accepted for the demo: one active guest link per workspace. A member creates or
rotates it; Convex stores only its hash. Opening the link creates an anonymous
Convex Auth session and attaches a share-derived workspace membership. Guests
use the canonical workspace UI and member APIs, including editing and inbox work.
Every member authorization rechecks the link behind a share-derived membership,
so rotation and revocation end access without a separate read-only data path.
Administrator authority remains independent of workspace membership.

## Retire Rectangle capability

Document cards are the only active spatial elements. Remove rectangle UI and
creation services; keep stored rows and receipt discriminants for compatibility.
Legacy endpoints are inert, inverses reject retired targets, paragraph links omit
rectangles, and old agent contexts must be replaced before reading or editing.
No data purge or History redesign accompanies this change.

## 2026-09-21 — Canvas document cap of 100

At Chris’s request, raise the active spatial document cap from two to 100. One
domain constant governs creation, restoration, bounded reads and the Add control.
Main/reply panels and removed cards remain excluded. This replaces the earlier
two-card prototype limit; it is not a 100-editor performance guarantee.

## Web Pages reuse sources and Element History

Expose existing Firecrawl captures as spatial source Elements in private workspaces.
Extend typed creation/lifecycle/geometry adapters rather than adding a second
History or text model. Keep old captures during refresh, bound canvas previews,
and load full captures only in the read-only panel. Keep separate source/document
capacity and preserve rows on deletion. Rectangle retirement remains unchanged.

## Text generation port (September 22, 2026)

Use a core-owned `TextGeneration` interface with a backend OpenAI Responses adapter.
V1 accepts text, optional instructions, an explicit model and output budget, and
returns completed/incomplete/refused output plus available usage. The adapter has
bounded requests and safe errors, with no automatic retries or provider response
storage. This is an outbound interface only: no frontend endpoint, conversation
store, agent framework or application feature is introduced. Future use cases own
workspace authorization, context selection and spending/retry policy.

## Browser-profile Presence ownership

One logical browser presence follows the focused eligible tab. A private profile
capability plus monotonically increasing claim epoch coordinates tabs under Web
Locks; notifications stop followers promptly, while Convex fences stale writes.
Claims retire old context activity atomically and bind ownership to current auth.
This keeps the existing context registry, pure activity policy and component expiry.
Failed channel writes retry the same sequence; newer state supersedes them. No
browser-process lifetime inference, idle timeout or leader-election framework.

## Landing canvas demo isolation

- **Status:** Accepted
- **Date:** 2026-09-22
- **Decision:** Mount the real Canvas against one private Convex workspace per
  anonymous guest identity, instead of a separate frontend-only imitation.
- **Why:** Visitors can use the actual editor, card gestures, menus, and History
  without seeing or changing another visitor's material.
- **Boundary:** Normal workspace membership protects all persisted data. The
  Carol Document is seeded, and one fixed Gatorade product page is captured via
  the existing provider job. An Image is displayed as a local example. Demo
  workspaces reject visitor-requested page capture and image upload. They
  reset to the seed arrangement on each landing mount without another provider
  request. Workspace records persist beyond a tab session until a separate
  retention policy is built.
