# Work register

Updated September 20, 2026 by Project Manager. End-to-end integration resumed by Chris; live acceptance incomplete.

## Authorization and boundaries

**Current assignment: overnight-demo-2026-09-20 / revision 2.** Authority: Chris's
10:52:25Z approval in PM task `01a0be20-3258-7ea3-a9c9-2f206803bd00`, followed by
10:53:25Z visual-design instruction. This record governs the current assignment;
feature scope remains unchanged. Initial-savepoint authorization was consumed by
0b6cebc/1765388. Chris separately authorized the respective agents to commit
their current work on September 22. No push or deployment is authorized.

The September 18 deletion-explanation request is HISTORICAL/ALREADY FULFILLED.
The September 20 07:30:50Z commit request is HISTORICAL/ALREADY FULFILLED by6db7bfb.
Delivery of an old instruction does not make it new. Handoffs state assignment ID,
source time/task, action and boundaries. Recipients check applicability before
redirecting work; actual new Chris steering remains authoritative. Before any Git
or external action, verify unconsumed scope-specific authorization internally.
Architect relays historical discrepancies as observations, not new assignments.
No new approval loop or coordinator role is required. On compaction/resume recover assignment ID, boundaries and next unfinished step
from this register before acting. Old drag Fix it was fulfilled by0b6cebc. Before
final response, check active completion criteria, not the last historical direct
user message. Team Manager observed DE switching to old drag work immediately
after a compacted event within the same turn; exact internal cause remains unknown.

Chris approved implementing F1–F12 locally with reversible defaults: one-URL
Firecrawl import/extraction, main document side panel with paragraph links,
AgentMail threads/collaborative replies, external MCP agent only, Google sign-in,
preassigned workspace members, minimal dashboard and protected read-only admin.
Visual design remains a completion criterion; Chris reviews final choices tomorrow.

Features must be removable without rewriting the document foundation. Use separate
feature UI/provider adapters and narrow explicit contracts, not a generic plugin
framework. Main/reply documents are distinct canonical canvas-owned children,
panel-only, excluded from visible-card capacity and generic card deletion. Preserve
existing user content, collaboration machinery, pending text and unrelated work.

No purchases, real email sends, pushes, production deployments, new agents or new
recurring automation. Confirmed local backend development/codegen is permitted.
Commit authorization covered the initial savepoint only; later changes stay uncommitted.
Workspace creation, invitations, role editing, account administration and in-app chat
are deferred. Prior candidate prototypes are not extra implementation assignments.

## Owners and handoffs

All tasks are on local. One writer per file; reviewers remain read-only.

| Role                    | Task ID                                | Current responsibility                                                                                                                                            |
| ----------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project Manager         | `01a0be20-3258-7ea3-a9c9-2f206803bd00` | This register, assignments, evidence, dependency coordination                                                                                                     |
| Software Engineer (SWE) | `01a087bd-5b10-7c32-a8ea-c9bbd22f9d93` | Backend/core/editor protocols, config/manifests/generated bindings, Router/App/CanvasPage/CanvasScope and existing canvas/document/presence/history hooks         |
| Design Engineer (DE)    | `01a063af-18ef-7cd0-9a9e-920dcbdeecdf` | New presentation modules AND explicitly released WorkspaceRoute/WorkspaceTools/DashboardRoute/AdminRoute; new sources/inbox/agentAccess binding hooks/controllers |
| Architect               | `01a084b4-3ceb-79d2-a622-0541582ff89e` | Independent access, paragraph, agent/MCP and provider review                                                                                                      |
| UX Designer             | `01a08e1a-58fc-7022-9e89-bf4bac9964ce` | Independent visual/browser review; fixtures reviewed, integrated review pending                                                                                   |
| Team Manager            | `01a087c5-f641-75d3-bb3a-13c7346f980f` | Roles/coverage/effectiveness; Design Technician existence remains unconfirmed                                                                                     |
| Product Strategist      | `01a07d81-6f30-7910-9d34-61759a257615` | Exploratory product advice; existing Analyst coordination automation, do not duplicate                                                                            |
| Hackathon Analyst       | `01a09d2f-ae76-7a20-9456-d24c46181b0f` | Competition research; latest substantive review September 15, not refreshed by PM                                                                                 |
| Software Engineer (2)   | `01a0ada3-9cf2-7642-852e-d01e49fe9adb` | Code-explanation advisor, not an implementation owner                                                                                                             |
| Explain Convex          | `01a0856b-1dbb-7392-a881-b74198dfe821` | Advisory                                                                                                                                                          |

DE's controller ownership was explicitly released by SWE and acknowledged by PM.
Neither edits the other's retained files without a new explicit handoff. SWE owns
implementation docs/build log; PM owns this register. Specialists may collaborate
directly. Some notifications are blocked by automatic approval review; PM reads task
outputs and relays within Chris's existing authorization when necessary.

## Feature status and acceptance

Every feature below is approved for implementation, but none has final end-to-end
sign-off yet. Tests reported by an owner are distinct from independent reviewer runs.

| Feature                                | Current evidence                                                                                                                                                        | Remaining                                                                             | Acceptance                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| F1 External data card                  | Implemented URL/content/extraction adapter and source UI; revision/refresh guards reviewed.                                                                             | DE binding fixture; live Firecrawl blocked by credentials.                            | Correct URL, content or prompted extraction, loading/failure/retry; live proof separate from mocks.     |
| F2 Main document and paragraph links   | Canonical panel editor and link/reveal binding implemented; seven paragraph tests include real collab/history. Architect verified concurrent replacement and merge IDs. | DE/UX assembled fixture; authenticated editor and multi-browser proof pending access. | Stable links, truthful missing target, canonical editor lifetime, no lost pending text.                 |
| F3 AgentMail inbox/collaborative draft | Thread list, refresh, distinct canonical reply editors and mounted-panel integration implemented.                                                                       | DE fixture reply switching; live mailbox/authenticated editing blocked.               | Open thread, collaborate on its separate reply, preserve pending text across panel switches.            |
| F4 External MCP collaboration          | Registered HTTP tests independently reviewed; actual local initialize/list/read/edit/retry/readback/revoke401 passed per SWE. Disposable data/helper removed.           | Final integration evidence; external connection UI fixture.                           | Scoped external agent reads/edits canonical document; stale edit conflicts and exact retry remain safe. |
| F5 Selected context                    | Versioned context snapshot and canvas/source/passage bindings implemented; selection is separate from grant authority.                                                  | DE fixture context/version/grant scope checks.                                        | Deliberately selected material retains observed version; explicit read/write grant scope.               |
| F6 Review/undo agent changes           | Agent attribution/history UI implemented; safe undo and structural conflict tests independently reviewed.                                                               | DE fixture change/undo/conflict behavior; live authenticated UI pending.              | Undo preserves intervening human text and structure or explicitly refuses.                              |
| F7 Deliberate email send/status        | Immutable review and dispatch guards, exact request lookup, evidence-based reconciliation and expiry independently reviewed. Lost-ACK UI now wired.                     | DE lost-ACK recovery fixture; no real sends authorized.                               | Exact reviewed target/text/recipients; truthful status, recovery without duplicate send.                |
| F8 Demo collaborator access            | Membership isolation, private document presence/revocation and History positive paths independently tested.                                                             | Approved Google identities pending; provision only explicit assignments.              | Assigned members collaborate; unauthorized users and revoked capabilities are denied.                   |
| F9 Google sign-in                      | Existing Google auth reused; signed-out gates reviewed and account/error states implemented.                                                                            | Real sign-in/account claim requires approved identity.                                | Account creation never grants workspace/admin implicitly; sign-out isolates state.                      |
| F10 Dashboard                          | Workspace list/open and signed-out/unassigned/error states implemented; signed-out visual review passed.                                                                | UX small-fix recheck; authenticated list pending assignment.                          | Clear login, available workspace Open, empty/loading/failure states; no creation UI.                    |
| F11 Demo workspace                     | Workspace shell binds canvas, documents, inbox, sources and agent controls; embedded canvas height fixed.                                                               | DE/UX actual binding fixture then authenticated browser proof pending setup.          | Usable coherent workspace with persistent canonical editors and narrow layout.                          |
| F12 Read-only admin                    | Protected paginated users/workspaces/memberships endpoint and UI implemented; signed-out denial reviewed.                                                               | Authenticated authorized/denied UI review pending approved admin identity.            | Read-only lists accessible only to platform admin; no protected data to others.                         |

| F13 Multi-select canvas elements | Implemented Shift-toggle and background marquee selection; mixed-card fixture passes. | Active-editor modifier behavior has code/focused-test coverage; full live text-selection check not run. | Select/toggle multiple Document and Web Page cards with visible selection feedback. |
| F14 Drag selected elements together | Implemented using existing group geometry; mixed-card browser fixture preserves spacing and avoids edit activation. | Live group gesture on saved records not independently repeated. | Drag one selected card to move the selected group while preserving relative positions. |
| F15 Delete selected elements together | Implemented selected-count delete control and keyboard safeguards; PM live pair deletion/Undo/Redo passes. | Pending/disconnected safeguards code-reviewed; focused History tests pass. | Delete all selected cards while preserving focused text input and pending-edit safeguards. |

| F16 Fixed main-document paper on canvas | Complete: canonical editor at fixed canvas origin, automatic height. | DE: 208 tests/build, growth/reveal/exclusion/session checks. PM: live readable page and recenter verified. | Selected cards appear above paper; existing saved positions are unchanged. |

Candidate demo: sign in → open pre-created workspace → open email → collect web
material → prepare agent context → collaboratively refine draft → deliberately send.
This is a review target, not permission to send real mail during development.

## Verified checkpoints and limitations

- PM independently confirmed initial savepoints `0b6cebc` and `1765388`.
  Prior History `6db7bfb` was already reviewed. Unexpected later `244ef4c`
  includes incomplete features; preserved, not pushed. No further Git mutations.
- SWE reports 203 tests, zero architecture violations, typechecks and build passing.
  Full check rerun underway after narrow formatting cleanup. Generated guidance
  and temporary browser artifacts are excluded, authored source remains checked.
- Architect independently passed agent structural-undo, provider revision/target/
  recipient/revocation, reconciliation expiry/stale completion, mocked exact delivery
  evidence and registered MCP HTTP sequence. These are bounded tests, not live providers.
- Actual localhost MCP initialize/list/read/edit/exact retry/readback/revoke401
  passed per SWE; disposable fixture records/helper removed and codegen cleanup confirmed.
- SWE reports positive private document presence join/publish/revoke, seven real
  ProseMirror paragraph tests including concurrent deletion/replacement and merge,
  and exact user/request submission lookup. Architect final focused review pending.
- DE is exercising actual workspace bindings in an isolated fixture. This can prove
  controller interactions, not authenticated browser/backend/provider integration.
- Credentials and approved workspace/admin identities remain unavailable. Live
  provider and authenticated browser acceptance cannot be claimed complete.

## Visual evidence and integration contracts

PM independently viewed fixture workspace at 1280×720. UX reviewed seven default
fixture views at desktop/narrow widths (workspace also 1024×768), finding no page
horizontal overflow. Navigation/focus fixes passed independent checks at 1440×900
and 390×844. Narrow reply scrolling, unavailable source, empty context, fixture
Undo/admin switches and uncertain-send feedback were exercised. DE then fixed
fixture-only draft/preview mismatch and heading spacing. Production typography,
loading/denied variants, dark mode, zoom and live collaboration are not signed off.

Actual frontend: http://127.0.0.1:5173. DE's browser was signed out; authenticated
workspace/editor/admin review awaits legitimate access. Live issues observed:
signed-out dashboard copy, workspace prompt without navigation, account failure
stuck loading, unfinished inbox binding. Embedded canvas height and nested editor
padding need actual visual verification. These are assigned to DE/SWE by file owner.

Key binding contracts: keep main/reply editors mounted while hidden and explicitly
control presence. WorkspaceLayout panelReturnFocus=inbox for replies. Main document
button selects canonical main identity and opens it. Inbox.review's reviewedMessageId,
version/text/recipients stay frozen for send; unknown maps to UI uncertain and explicit
Inbox.reconcile checks delivery without resend. Context passages retain observed
version. AgentAccess.connectionInfo returns actual HTTP origin; no guessed VITE URL.

Fixture preview: http://127.0.0.1:5181/?view=workspace (dashboard/reply/source/inbox/
admin/agents variants). Restart with `python3 -m http.server 5181 --bind 127.0.0.1
--directory /tmp/presentation-preview`. It is labeled fixture-only, never a live demo.
UX evidence: output/playwright/ux-review-2026-09-20; live signed-out screenshots in
/tmp/integrated-*.png. Preserve unrelated artifacts; do not include them in commits.

## Outstanding setup and morning handoff

SWE confirmed local deployment FIRECRAWL_API_KEY, AGENTMAIL_API_KEY and
AGENTMAIL_INBOX_ID absent using names/presence only. Live provider checks blocked.
PM asked Chris for credential location only, with no response yet. Missing provider
credentials block their live tests, not independent implementation. No secret values
may appear in logs, task messages, docs or frontend variables. Demo name/slug default Demo workspace/demo. PM requested explicit Google emails
and platform admin assignment; response pending. Never first-user auto-admin.

Deliver runnable local routes, F1–F12 actual statuses, verification evidence, setup
blockers and reversible design choices. Do not call fixture or fake-provider results
live integration. Goal remains active until all requirements are proved or a genuine
external blocker remains after independent work is exhausted.

## Continuity incidents and current handoff

Historical deletion/pause and commit requests were replayed after compaction.
PM verified original timestamps and restored this current assignment. Team Manager
observed DE switching to old drag work immediately after compaction; internal cause
unknown. Old drag work was already saved by0b6cebc. SWE unexpectedly committed
incomplete features as244ef4c beyond the savepoint-only authorization; Chris was
informed. Preserve history; no further commits/amends/resets/pushes.

Current checkpoint: both SWE and DE report full npm run check PASS (43 files,
203 tests, architecture/types/formatting) and build PASS. Existing bundle-size
advisory remains. Architect independently passed19 final focused cases for private
document presence/revocation, concurrent paragraph replacement/merge and exact
submission lookup. Earlier agent/provider/MCP narrow gates are closed.

PM found lost-ACK UI recovery gap; SWE added read-only Inbox.submission scoped to
current user/thread/request and DE now consumes it reactively. No new dispatch is
performed by lookup. DE fixture recovery verification remains pending.

UX real signed-out routes passed1440x900/390x844 dark navigation/no overflow;
CSS200% fits, native zoom unverified. P3 fixes applied per owners: workspace heading,
hide admin button signed out, browser title Pluribus. Independent recheck running.

Actual binding fixture: http://127.0.0.1:5181/bindings.html. Real workspace controllers
with mocked auth/editor/canvas/backend; no provider effects. DE/UX completed panel
switching, reply scrolling, source/agent controls, recovery and narrow layout checks.
This does not establish real editor rendering or authenticated backend integration.

Next: obtain missing setup inputs and finish live acceptance checks. Local
implementation, reachable review and morning handoff are ready. Live provider credentials and explicitly approved member/admin assignments
remain the only known setup blockers; do not guess values or grants.

PM independently viewed binding fixture at1280x720 and changed main fixture editor
to pending text, switched Inbox→Main, verified text and Saving local edits remained.
This proves mounted binding state retention only; editor/backend are mocked. Review
tab closed; no real data or provider effect.

UX final independent recheck closed all three P3 findings. Actual binding fixture
passed desktop/narrow layout, panel switching, opener focus return and scrolling
to lower controls; no new layout blockers. Real editor typography/canvas rendering
remain unverified because mocked. DE reports retained pending text, stale review,
lost-ACK recovery with exactly one mocked send, captured passage version, explicit
grant scope/revocation, connection retention and undo-conflict feedback pass.
DE final report: exact/deleted paragraph handling and narrow-screen focus pass; integration work complete locally, with setup-dependent acceptance still open.

## Morning review decisions

- Review main/reply side-panel layout and paragraph-only linking with real material.
- Review source cards and agent controls placement; feature UI/provider adapters
  remain separate modules so these experiments can be removed or replaced.
- Confirm Google member emails and which explicitly approved user is platform admin.
- Supply backend credential locations for Firecrawl and AgentMail, then bind the
  intended mailbox explicitly. No real-send verification without separate authority.
- Finish authenticated two-browser editing/presence/link/admin checks and actual
  editor typography/embedded canvas sizing. Fixture success does not close these.

Local app: http://127.0.0.1:5173. Fixture: http://127.0.0.1:5181/bindings.html.
Setup and module contracts: docs/workspaces.md. Latest check/build:203tests passed;
no further commits/pushes authorized. Goal is not complete while live setup and
resulting acceptance checks remain unavailable.

Final DE evidence: /tmp/workspace-bindings-main-1440.png,
/tmp/workspace-bindings-reply-390.png, /tmp/workspace-bindings-tools-390.png.
Source cards currently live in the tools dock, not draggable canvas nodes; review
this reversible presentation choice tomorrow. DE external-MCP unverified statement
refers to its UI lane; SWE actual local HTTP MCP proof remains separately recorded.
PM independently opened current5173 root: title Pluribus, Google sign-in and correct
signed-out copy. Both local server listeners present. Sandboxed curl could not
connect, so its HTTP000 is not evidence of server failure; browser success is.
Temporary verification helper absent from source; HEAD remains244ef4c, no later
commits. Implementation/review tasks now idle except setup-dependent follow-through.

Blocked audit1: independent implementation and reachable reviews are exhausted.
Remaining acceptance requires missing provider credentials and explicitly approved
Google member/admin identities, then live provider/authenticated-browser checks.
Prior pending questions remain unanswered; no duplicate request or guessed grants.
Goal remains active for blocked-threshold audit, not complete.

Blocked audit2: current task status confirms implementation/review work has ended;
no new user setup inputs. Same provider-credential and approved-identity blocker
remains. No additional safe independent implementation is outstanding.

Blocked audit3: same unanswered credential-location and approved-identity inputs
remain across three consecutive goal turns after independent work was exhausted.
Goal marked blocked, not complete. Resume with provider configuration locations
(no secret values in messages) and explicit Google member/admin assignments.
Then perform the remaining live checks recorded above; do not substitute fixtures.

## Current resumed integration

Chris explicitly requested end-to-end integration after reviewing URLs and current
limits. Revision2 resumes existing SWE/DE ownership on actual local backend/UI.
Earlier blocked audits are historical; resumed audit starts fresh. Chris provided
hello@chriswan.me for demo workspace access. Provision regular membership only;
admin designation unanswered, do not infer it. Provider locations/inbox still pending.
No new commits/pushes/production deployments/real sends authorized. Finish real
workspace login/claim/canvas/editor/link/agent/inbox/source flow and independent
visual review as setup becomes available. Mock fixtures do not close live gates.

Revision2 setup progress: Chris explicitly approved hello@chriswan.me as demo admin
as well as member. SWE created real Demo workspace nd730zawmbzvy2pdm5mpzk24sn8esjrb
and updated approved assignment via internal authorizeAdministrator. No synthetic
session; verified Google login and Dashboard claim remain required. Seven focused
access tests passed per SWE; Architect reviewing new internal upgrade.
Google sign-in in PM in-app tab4 reached passkey; handed to Chris. Provider settings
still absent on fresh local check; question for secure locations/inbox pending.

Revision2 SWE full check/build PASS:204tests, types, architecture and formatting.
Actual Google dashboard claim still pending; no provider/send calls, commits or
pushes. Existing-assignment admin approval documented without personal address.

Current sign-in defect fixed: local SITE_URL was stale http://127.0.0.1:5174 while
frontend dev runs5173. SWE changed only local SITE_URL to5173 and verified readback;
installed Convex Auth redirect resolver maps relative authReturn to5173 and rejects
explicit5174/arbitrary origins. No key/provider-secret rotation or auth-code reuse.
Auth docs corrected; Chris must restart Google login from5173. Full check pending.

Current provider integration: Chris supplied both provider credentials; PM securely
set AGENTMAIL_API_KEY and FIRECRAWL_API_KEY on confirmed local anonymous-backend
(two new settings). Values never printed or committed; temporary file removed.
Inbox design updated to provision one AgentMail inbox asynchronously on workspace
creation, with setup/failure/retry and stable idempotency. Existing demo uses same
provisioning path; manually supplied AGENTMAIL_INBOX_ID no longer intended. SWE
owns backend/provider contract and live checks; DE owns setup/retry presentation.
No real mail sends/purchases/pushes/prod authorized. PM installing requested
AgentMail MCP endpoint separately; product uses backend-only credentials.

AgentMail MCP installed via requested add-mcp CLI to project .codex/config.toml,
server agentmail URL https://mcp.agentmail.to/mcp, enabled, no embedded headers/key.
MCP OAuth authentication is separate and not yet verified. PM actual app root still
signed out. DE setup/retry UI reports204tests/full check/build pass; backend
idempotent provision implementation still active, so final integrated checks pending.

Provisioning implementation/review: durable UUID client_id persisted before dispatch,
idempotent retry,60s watchdog/revision guard, one-to-one ownership, member-only retry.
Architect independently passed both new tests and code review, no actionable defect;
ownership-conflict path inspected but lacks dedicated regression. Actual Demo setup
first attempt failed before mailbox binding; SWE diagnosing provider response using
same persisted identity. No mail sends. Await actual provider result, not assumed
credential validity from env installation.

Actual AgentMail provider blocker: POST/v0/inboxes returns403 ForbiddenError,
code missing_permission. No inbox bound or sends. Same persisted client_id retained;
stop retries until permission changes. PM asked Chris to enable inbox creation or
provide scoped-key location. SWE full check/build PASS206tests. Firecrawl live
public-page adapter verification assigned independently; authenticated UI remains
separate, current in-app browser signed out.

Firecrawl live production-adapter checks pass for example.com main content and
prompted JSON extraction, returning only boolean evidence. Temporary helper removed
and generated API cleaned; full206test check/build passed per SWE. Authenticated
source UI still separate.
Chris supplied replacement AgentMail key after403. PM applied it to confirmed local
backend (1updated), redacted output and removed temp file. First automatic approval
review timed out before execution; one allowed retry succeeded. SWE dispatched to
retry existing persisted Demo client_id and verify real inbox/thread read; no sends.

AgentMail live SUCCESS after replacement key: existing provisioning record/client_id
reused, setup ready/error null, exactly one Demo workspace inbox binding. Address
filthyaffair115@agentmail.to (provider-generated). Actual local production readInbox
adapter returns0threads/0messages. No duplicate creation or outgoing send. Temporary
read-only VerifyInbox removed; codegen cleanup underway. Creation/read credential
blocker closed. Real inbound/reply UI journey still needs received mail and actual
Google session; send stays unauthorized. DE asked to ensure ready UI shows address.

Ready inbox address now exposed by workspace-authorized Inbox.list.address;
opaque provider IDs return null. DE controller renders selectable address and
incoming-mail/refresh guidance. SWE reports full206test check and build pass.
No additional inbox creation or mail sends. Actual signed-in UI/incoming mail
acceptance remains pending; preserve any newer direct design work in DE task.

## Current product change: remove Rectangle

Chris explicitly requested removal of Rectangle element. SWE owns coherent canvas
capability removal (creation/render/selection/history/presence and backend/public
contracts), with DE frontend handoff by file. Preserve document editing/history,
source/inbox integration and unrelated newer design edits. No destructive purge
of historical stored records; retired history must not revive rectangles. Include
paragraph-link/agent-context surfaces in removal inventory. Update behavior spec
for this explicit decision; focused regression and full check/build required.
No commits/pushes/production deployments authorized.

Rectangle-removal browser checkpoint: PM actual /canvas now has no Add rectangle
control and both preexisting document cards/text remain. Add document correctly
stays disabled at existing two-card capacity. No user content changed. Backend
retirement/history regressions and independent Architect review still in progress.

Current removal continuity correction: SWE resurfaced exact old commt changes text.
PM verified only direct source event is2026-09-20T07:30:50.632Z, already fulfilled;
HEAD remains244ef4c. Stopped Git redirection before new commit. Current authorized
task remains Rectangle removal; finish tests/spec/docs and independent review.

Rectangle removal COMPLETE: SWE final full check PASS197tests/43files, architecture,
types, formatting and build; confirmed local codegen succeeded. Renderer/creation
controls/dead styles removed, old rectangles excluded from projections/context/link/
presence, rectangle writes and History revival disabled. Stored rows retained.
Three dedicated regressions now cover old context read+apply, retained link omission
and presence filtering. Six migrated fixture expectations corrected by document ID
and all-member geometry. Architect independently passed34backend+9frontend and8
agent tests, no actionable defect; PM actual browser verified no Add rectangle and
both user document cards/text intact. Documentation/spec updated. No Git mutation
or user-data purge. Other end-to-end demo acceptance remains separate.

Minimap COMPLETE: PM integrated React Flow MiniMap in CanvasPage/CSS. Browser
verified pan/zoom and unchanged document geometry/text. Full check passes197tests
and build passes after two initial architecture fixture timeouts. CanvasPage/CSS
ownership released; no backend or Git mutations.

Standalone editor presentation: coordinated DE implementation, UX criteria and SWE
independent review. PM desktop browser review passed centered paper, readable
spacing and toolbar staying fixed while document scrolled. DE reports full
check197tests/build and isolated real-editor interaction/mobile/theme checks pass.
SWE11focused tests/typecheck pass; no actionable integration defects. Live backend
acknowledgement and panel reopen were not exercised by this design preview.

## September 21 — Multi-selection follow-up

Chris approved F13–F15 and asked PM to work with Design Engineer while away.
DE temporarily owns frontend canvas selection/gesture/UI files and focused tests;
PM owns this feature list and acceptance review. No additional agents needed.
Build on existing group geometry and per-element deletion History; preserve mixed
Document/Web Page behavior, pending text and existing user data. No Git publication.

F13–F15 complete: DE full check206tests/build pass; mixed-card Shift toggle,
marquee and group movement verified in disposable React Flow fixture. PM live
workspace created two disposable blank cards, marquee-selected exactly those IDs,
Delete selected(2) removed both, two Undo restored both, two Redo removed both.
Original user cards untouched. Shift modifier via PM locator did not toggle
(native keydown not independently tested); DE keydown-driven fixture passed.

## September 21 — Main document canvas paper

Chris requested the rich editor as a centered, immovable extensible paper sheet.
PM interpretation: fixed canvas origin, natural content height, whole-view pan/zoom;
Main document action returns to readable writing area. DE owns frontend integration;
retain one canonical mounted editor, paragraph links and pending recovery. Exclude
paper from card selection, drag, resize, deletion and Element History. Replies stay
in panels. No backend model change or data movement is planned.

F16 complete: DE reports 208 tests/full check and build pass. Disposable preview
verified natural growth (1000 to 2618px), stable editor mount while tools toggle,
paragraph reveal/highlight, fixed drag position, marquee exclusion and paused
controls. PM independently verified the live main editor and recenter visually.
Paper sits above unselected cards; selected cards rise above it. This preserves
existing saved positions, with overlapping unselected portions temporarily hidden.
New cards start beside paper. No live document text or card geometry changed.

## September 21 — Web Page failure and recovery review

Current Chris request: Software Engineer reviews backend failure states and recovery
while Design Engineer reviews card designs. Read-only review and focused existing
tests; no implementation changes, provider calls, deployment or Git publication.
SWE subagent owns this bounded review because existing desktop task messaging is
unavailable in this session. PM checks UI consequences and consolidates findings.
Review covers provider/validation failures, stuck jobs, retries, stale completions,
delete/restore races and preservation of the last successful capture.

Review complete: SWE passed 30 focused tests; one live-provider test skipped.
Code inspection found P1 interrupted jobs can remain fetching indefinitely and
empty successful provider responses can replace good captures; P2 repeated failed
refresh can misattribute an originally absent prompt and concurrent refreshes can
duplicate provider work. Recommended revision-scoped expiry, output validation,
exact provenance retention and active-request deduplication. These gaps are not
yet fixed or regression-tested. Ordinary failure retention, authorization and
stale/deleted-source completion guards are already covered. No live calls made.

## September 21 — Web Page recovery implementation

Chris now authorizes SWE to close the four reviewed gaps and prepare a clear API
handoff for DE after the redesign. SWE owns backend/core, regression tests and
API handoff documentation. PM owns coordination and this register. No UI design
or implementation changes; no Git publication, deployment or live provider calls.
Acceptance: bounded stuck-job recovery; reject unusable results without losing
capture; retain exact provenance; avoid duplicate concurrent refresh work; publish
explicit state, retry and revision semantics for existing/new UI consumers.

Recovery implementation complete: SWE added revision-scoped two-minute deadlines,
scheduled expiry and authorized legacy recovery; validated required capture output;
preserved absent-prompt provenance; coalesced identical active refreshes and guarded
explicit replacement with expected revision. Existing request still returns source
ID. DE handoff: docs/web-page-api.md. No UI changes or runtime deployment.
SWE validation: 37 focused passed/1 live skipped; build, architecture, types and
format passed. Default full check hit 6 fixture timeouts; reduced-concurrency suite
239 passed/1 timeout/1 skipped; timed-out architecture file alone 25/25 passed with
15-second bound. No clean default full-suite pass claimed.

## September 21 — Design Engineer API handoff

Chris requests handoff to Design Engineer now. Backend contract is ready at
[Web Page API](web-page-api.md). DE should use it when integrating the current
card redesign: preserve last capture during refresh/failure, use request revisions,
handle explicit active-request replacement/conflicts, and expose deliberate legacy
recovery where appropriate. Retain current design direction; no new redesign is
requested by this handoff. Backend changes are local and not yet deployed.
Validation and limitations are recorded in the preceding entry. Existing desktop
DE task cannot be directly notified with currently available task tools; this is
a durable handoff, not confirmation of message delivery or DE acknowledgement.

Handoff delivered: direct task messaging became available again and successfully
sent the API contract and integration scope to Design Engineer task
01a063af-18ef-7cd0-9a9e-920dcbdeecdf at Chris's request. This supersedes the
previous delivery limitation; acknowledgement/completion remains pending.

## September 21 — Web Page formatted captures

Chris approved Markdown/text, CSV and JSON-record tables, mixed text/data, raw
JSON fallback and original response access; distinguish empty results from parse
failure. DE owns frontend rendering and focused verification with existing design.
PM owns coordination and acceptance. Preserve stored capture and provenance; no
new backend/provider behavior, Git publication or deployment in this assignment.

Formatted captures complete: DE added modular Markdown/GFM, JSON-record and CSV
tables with mixed content, raw nested/malformed fallback and original text/data.
Full panel offers Auto/Text-Markdown/CSV/JSON override; canvas preview never parses
truncated structured data. PM independently passed 12 focused tests and disposable
browser acceptance for mixed/empty/malformed/raw access and all-string CSV override.
DE full check passed 255 tests/1 skipped, formatting and build passed. Build retains
large CanvasPage chunk warning (~989kB minified/310kB gzip). No backend changes, live
provider calls, Git publication or deployment. Stored captures remain unchanged.

## September 22 — Extraction intent and table output

Chris approved fixing observed HN capture: format-only prompt returned instruction
metadata rather than page records, and raw layout/navigation dominated preview.
SWE owns explicit structured table contract/backend/core/tests/API handoff; DE owns
separate extraction intent/display controls, renderer integration and conservative
compact previews. PM owns coordination/acceptance. Preserve existing captures and
recovery/revision/provenance semantics. No provider calls, Git publication or deploy
authorized by this implementation assignment. Desired HN content asked separately;
do not invent extraction intent or overwrite saved capture while awaiting it.

Extraction intent/table implementation complete. SWE added explicit requested
columns, strict provider/local rows validation, narrow format-only rejection,
table-aware request identity and capture provenance. DE added shared create/edit
controls, capture-schema rendering and display-only navigation filtering with
neutral full-capture fallback. PM independently verified mock format rejection,
exact table request payload, stored column order and neutral fallback; 16 focused
renderer tests independently passed. SWE/DE integrated 282 tests passed/1 skipped;
architecture/types/build passed. Final formatting correction passed full format
lane; newest frontend regression lane17/17 passed. No clean re-run of entire check
after that formatting-only correction claimed. Existing HN capture untouched;
intended HN facts remain awaiting user clarification. No live extraction or deploy.

## September 22 — Instruction-only extraction correction

Chris supersedes explicit format/column controls: infer extraction shape and
columns from instructions, honoring names when provided. SWE owns inferred-output
contract and validation/backward compatibility; DE removes shape/column inputs
and integrates renderer. Single URL plus optional instructions; no extra user
schema configuration. Preserve stored captures, recovery and raw access. No live
provider calls, deploy or Git actions in this implementation. PM acceptance/register.

Instruction-only correction complete: form now URL plus optional instructions,
no shape/column controls. Single schema-driven provider call infers typed text/table
envelope and columns; explicit names honored through provider instruction. New
captures mark inferred-v1; shape validated, old capture/table formats preserved.
Format-only requests accepted with relevant-source extraction instruction. PM mock
browser confirmed prompt-only payload and inferred mixed text/table rendering;
independently20 frontend tests passed. Shared full check301 passed/1 live skipped,
architecture/types/format/build passed; existing large chunk warning remains.
No provider calls/deployment; factual accuracy of inference remains unverified.

## September 22 — Above-the-fold capture screenshots

Chris requests viewport-only screenshot on Web Page Content Card. SWE owns
Firecrawl request, capture-tied durable image/API and recovery tests; DE owns
card/panel image presentation and verification. PM acceptance/register. No new
configuration or full-page screenshot; preserve existing card geometry/captures.
Verify provider screenshot semantics and storage lifetime. No live paid fetch,
deployment or Git publication in this implementation.

Viewport screenshot complete: same Firecrawl scrape requests fullPage:false at
1280x800, persists validated image in Convex storage with capture provenance.
Image-only failure keeps successful text; failed full refresh retains old image.
Accepted images retained for snapshots/Undo; pending upload cleanup revision-safe.
DE compact/expanded/panel and broken-image UI passed PM disposable visual review;
PM independently3 screenshot frontend tests passed, DE11 focused passed. SWE13
screenshot tests and full317 tests passed/1live skipped; architecture/types/format
and build passed. No paid call/deployment/Git. Real provider image-host/decode
compatibility not exercised; existing captures gain screenshot on a future refresh.

## September 22 — Presence reliability and active-tab browser session

Chris approves latest-state per-channel retry and explicitly selects one presence
following the active tab/window across a browser session. SWE owns implementation,
regressions and architecture proposal; PM acceptance/register. Background tabs must
not publish competing activity; ownership handoff and stale messages need fencing.
Preserve unrelated work. No Git publication, deployment or real document edits.

PM accepted SWE presence-only design: same-origin Web Lock allocates owner epochs;
shared browser-profile coordination identity is separate from display guest ID.
Server validates owner/epoch to fence delayed old claim/activity/leave across
contexts. Followers read only; focused eligible tab claims; no heartbeat stealing.
Existing participation expiry is separate from browser process lifetime. Retry
queue remains per-channel latest state with exact-retry sequence reuse. Verify
focus/reload/crash/stale-write/auth changes; unsupported coordination fails closed.

Presence implementation complete in working tree: latest-state retries with
100ms–2s capped backoff/exact sequence reuse; browser-profile active-tab ownership
via Web Locks + notifications and server epoch/account fencing. Followers read,
old owners cannot write/leave successor; legacy clients must reload. PM independently
10 queue/ownership tests passed; SWE40 focused and full347 passed/1skipped,
architecture/types/build passed. Presence formatting passed; concurrent MCP files
prevent full formatting pass. Disposable real-browser smoke timed out in focus
handoff assertion, so real-browser handoff remains unverified. No deploy/Git.

## September 22 — Current local savepoint

Chris authorized the respective agents to commit their current work. SWE committed
backend/core, retained frontend hooks, guest workspace access and implementation
documentation as `32f8738`; full check passed 370 tests with one skipped, and build
passed. No push. DE presentation/UI changes remain uncommitted: automatic approval
review rejected DE's broad mixed-ownership stage/commit and requested exact-scope
approval. PM owns only this register; tooling artifacts and review output remain
untracked. The rejection is not authorization to commit DE files through another
agent.
