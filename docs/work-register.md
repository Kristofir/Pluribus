# Work register

Updated 2026-09-20 by Project Manager. Overnight implementation authorized by Chris;
initial savepoint and read-only architecture/readiness reviews dispatched. Chris retains product and final design
authority. Team Manager owns role coverage and effectiveness.

This register tracks handoffs, not a product roadmap. Existing experiment details
remain in [prototypes](research/prototypes.md), behavior requirements in
[canvas behavior](canvas-behavior.md), and build evidence in [hackathon.md](../hackathon.md).
No existing coordination register was found, including in hidden project files.

## Current work

### Hackathon feature list — overnight implementation approved

Chris approved the overnight goal and reversible defaults: one-URL scraping/extraction,
main document side panel with paragraph links, external MCP agent only, collaborative
email draft and deliberate send/status, and the simplified demo access flow. All
F1–F12 are in scope; missing credentials block only their integration and must not be
hidden behind mock success. No purchases, actual email sends, pushes or deployments.
Current commit authorization covers the initial savepoint only.

Keep features modular and easy to remove or replace tomorrow: feature-owned UI and
provider adapters, explicit narrow contracts, no speculative framework. Reuse safe
collaborative document machinery rather than create competing editable copies.
Chris retains final design authority. Visual verification is a completion requirement.
The table retains the original proposal detail; approved defaults above supersede
its unresolved placement, link-granularity and single-URL suggestions.

| ID | Feature | Proposed completion target | Next planning action / dependencies |
| --- | --- | --- | --- |
| F1 | External data card using Firecrawl | User supplies a URL and retrieves main page content, or supplies an extraction prompt and receives specific data; source and fetch/error state are visible. | Decide readable content versus structured fields. One URL and on-demand fetch are PM scope suggestions, not accepted limits. |
| F2 | Main collaborative document linked to canvas material | A Google Docs-like editor outside a card, placed within the canvas or alongside it; canvas elements can link to document sections. | Chris to choose placement and link granularity. Paragraph-only links and side panel remain suggestions. Define link behavior after edits/deletion. |
| F3 | AgentMail inbox and collaborative reply draft | User opens an email thread and edits its response as a collaborative document. | Define thread-to-draft relationship and editor surface; coordinate with F2 and F7. |
| F4 | MCP document collaboration | A user's agent can access, read and write a document while humans collaborate; agent writes preserve intervening human edits or surface a conflict. | Architect to advise on safe edit semantics and access once planning consultation is dispatched; depends on document identity and F8 access rules. |
| F5 | Selected context for agents | User selects canvas cards or document passages and communicates what the agent should work on. | Define selection and intent handoff through F4; passage selection intersects F2. |
| F6 | Review and undo agent changes | Users can identify agent changes, retain concurrent human work, and undo unwanted agent changes without erasing others' contributions. | Establish what existing authorship/history supports and what needs extending. Full suggestions UI is optional, not committed scope. |
| F7 | Complete the email loop | User deliberately sends a reviewed draft to visible recipients and sees success, failure or uncertain delivery. | Define sending authority and how the exact draft is fixed for sending; depends on F3 and F8. No actual email sending authorized by this planning entry. |
| F8 | Demo collaborator access | Preassigned demo collaborators can access the same workspace; people and agents have explicit access boundaries. | Invitations and role editing deferred by Chris's demo simplification. Agent authorization still needs scoping for F4; coordinate with F9–F12. |
| F9 | Google sign-in | Google-only sign-in; first sign-in creates an account. | Check existing authentication before assigning changes; connect identity to preassigned workspace membership. Demo scope accepted by Chris. |
| F10 | User dashboard | Show the user's available workspaces with an Open button; use a pre-created demo workspace. | Define minimal workspace listing and entry route; depends on F8/F9. No workspace creation UI. Demo scope accepted by Chris. |
| F11 | Demo workspace | One canvas per workspace with its documents and inbox. | Connect existing canvas and planned document/inbox surfaces to the workspace; depends on F2/F3/F8/F10. Demo scope accepted by Chris. |
| F12 | Read-only admin panel | Protected list of users, workspaces and memberships. | Define administrator access and minimal read-only views. No account administration or role editing. Demo scope accepted by Chris. |

Accepted demo entry: **Google sign-in → dashboard → open pre-created workspace**.
Preassign demo collaborators. Workspace creation, invitations, role editing and
account administration are deferred. Source traceability, save/reopen expansion,
failure-recovery expansion and submission-readiness additions suggested later in
the discussion were held off by Chris; they are not added as separate feature items.

Candidate demo accepted for the planning list: **open an email → collect relevant
web information → ask an agent to help draft → refine the response together → send**.
This is a candidate to scope, not a fixed product direction. Reusing the main
document as the reply editor remains an unaccepted scope suggestion.

### Overnight assignments and gates

| Work | Owner / reviewer | Next action | Completion evidence |
| --- | --- | --- | --- |
| Initial code savepoint | Design Engineer / existing validation recorded | Commit existing eight intended editor/drag files only; sole Git writer until done. | Committed `0b6cebc`, independently confirmed by PM via Git; only this register remained untracked. Known validation limitations retained. |
| Coordination savepoint | Project Manager | Commit this register now that code savepoint released Git. | Committed `1765388`; initial savepoint complete. |
| Modular architecture and contracts | Architect / Software Engineer feasibility consultation | Read-only proposal of ownership, dependencies, edit semantics and access boundaries. | Architect supplied concrete module/access/edit contracts; PM accepted, implementation review pending. |
| Backend readiness | Software Engineer / Architect | Read-only inspect existing foundations and credential names/presence, never values. | Readiness reported: existing Google and text sync foundations; workspace access absent. Firecrawl/AgentMail credentials absent in checked files, local backend env still unverified. |
| Frontend implementation | Design Engineer / UX Designer visual review and Architect boundary review | Implement new feature presentation modules with injected typed props; retain Intent UI. SWE owns existing controller/router integration until explicit handoff. | Dispatched; assembled UI/browser evidence pending. |
| Backend/core implementation | Software Engineer / Architect | Implement access → canonical panel docs/paragraph links → source/mail/context → agent edit/undo/send ledger. Own backend/core/editor protocols/config/router/root. | Dispatched; tests and independent review pending. |
| Visual acceptance | UX Designer / Chris final design tomorrow | Read-only checklist now; inspect assembled UI when ready. | Checklist received; assembled UI review pending. Include desktop nonmodal panel, narrow screen readability, keyboard/focus and honest sync/send states. |

Main and reply documents are distinct canonical canvas-owned children with explicit panel presentation, no duplicate visible cards and no panel-document delete control in this demo. Existing card deletion/history must remain intact.

No agents may overlap edits. PM owns this register. Engineer and Design Engineer
must agree shared files before editing. Architect and UX Designer review read-only.
Independent review is separate from owner-reported tests; external provider behavior
requires real evidence, and unavailable checks remain explicitly unverified.

### Existing implementation handoffs

| Item | Owner / reviewer | State and evidence | Next action | Completion criteria |
| --- | --- | --- | --- | --- |
| Session-scoped Element History | Software Engineer / Architect | Approved, implemented, reviewed, committed as `6db7bfb`. Architect's latest review reports all three findings resolved. Engineer reports 176 tests passing with longer timeout, types, architecture, build and browser checks. PM independently confirmed commit and Git state, not runtime behavior. | No implementation handoff remains. Keep release separate; push only when Chris requests it. | Implementation/review complete; any later release needs explicit authorization and its own evidence. |
| Editor recovery, focus and drag-status fixes | Design Engineer / Software Engineer proposed for integration review; Architect if a boundary issue arises | Implemented and committed in savepoint `0b6cebc`. Latest drag fix explicitly requested by Chris. Agent reports browser checks, six projection tests and build passing; latest full check reports 175 passing tests and two architecture fixture timeouts. No independent review of this diff found. Evidence: current diff, Design Engineer task, latest entries in canvas behavior and hackathon log. | Include integration regressions in overnight review; retain Design Engineer ownership of the original fixes. Savepoint does not imply new independent review. | Reviewer checks focus/recovery and History interaction against behavior requirements; findings resolved by owner; validation outcome and limitations recorded. Commit/push/deploy remain separate decisions. |
| Recurring architecture fixture timeouts | Project Manager owns triage handoff; technical owner not assigned (Software Engineer proposed), Architect proposed reviewer | Observed validation gap, not an approved repair assignment. Engineer reports success with longer timeout; Design Engineer's latest full check still times out on two fixtures. Cause not established. | Define a bounded diagnostic assignment if Chris wants this pursued; do not treat longer-timeout success as a repair. | Reproducible cause and disposition, with default-check outcome documented; any repair has an approved scope and one implementation owner. |
| Design Technician availability | Team Manager / Chris for any new role creation | Unconfirmed. Team Manager's latest review could not locate a usable task after an earlier queued creation. | Leave coverage question with Team Manager; do not create a duplicate or route work to the pending setup ID. | Usable task ID and scope confirmed, or explicit decision that no separate role is needed. |

States are distinct: proposed, approved, implemented, reviewed, verified, committed,
pushed, deployed. A reported passing check is agent evidence, not independent PM
verification. No tests were rerun by PM during orientation. Overnight tests must be attributed to their runner.

## Shared checkout and release state — orientation baseline

- Independently observed: branch `main`, HEAD `6db7bfb`, one commit ahead of local
  `origin/main` (`2239e45`). Remote was not fetched; this is not a live remote check.
  Engineer explicitly reported that the commit was not pushed. Deployment unverified.
- Preserve Design Engineer's eight modified files: `CanvasNodes.test.ts`,
  `CanvasNodes.ts`, `DocumentNode.tsx`, `UseCanvas.ts` under frontend canvas;
  `CollaborativeEditor.tsx`, `UseDocumentEditor.ts` under frontend documents;
  `docs/canvas-behavior.md` and `hackathon.md`.
- Reviewers stay read-only; proposed findings return to the implementation owner.
  Before dispatching edits, refresh Git state and agree file ownership. Specialists
  may communicate directly. Project Manager edits this register only.

## Team and existing advisory work

All IDs below are on `local`; titles and states below reflect orientation. Live overnight assignments are tracked above.
Idle/not loaded does not imply unassigned or completed work.

| Current task title | Task ID | Observed state / scope |
| --- | --- | --- |
| Team Manager | `01a087c5-f641-75d3-bb3a-13c7346f980f` | Idle; roles and coverage |
| Software Engineer | `01a087bd-5b10-7c32-a8ea-c9bbd22f9d93` | Idle; History implementation owner |
| Architect | `01a084b4-3ceb-79d2-a622-0541582ff89e` | Idle; architecture and focused review |
| Design Engineer | `01a063af-18ef-7cd0-9a9e-920dcbdeecdf` | Idle; current editor/drag fixes owner |
| Product Strategist | `01a07d81-6f30-7910-9d34-61759a257615` | Idle; helps Chris learn from disposable prototypes |
| Hackathon Analyst | `01a09d2f-ae76-7a20-9456-d24c46181b0f` | Not loaded; latest substantive submission review September 15 |
| UX Designer | `01a08e1a-58fc-7022-9e89-bf4bac9964ce` | Not loaded; September 10 FigJam flow is a proposal, not an approved specification |
| Software Engineer (2) | `01a0ada3-9cf2-7642-852e-d01e49fe9adb` | Not loaded; code-explanation advisor, not a second implementation owner |
| Explain Convex | `01a0856b-1dbb-7392-a881-b74198dfe821` | Not loaded; advisory |

Product Strategist's September 19 task record shows the existing Analyst
coordination heartbeat; do not duplicate it. No new findings were reported there.
Competition coverage has not been refreshed by PM. Old candidate experiments and
the FigJam flow do not authorize implementation.

## Morning handoff

Deliver a runnable local demo, F1–F12 status with verification evidence, unresolved
integration blockers and reversible design choices for Chris to adjust. In-app chat
is deferred until tomorrow. No need to wake Chris for routine implementation choices
within approved defaults; record material blockers and continue independent work.

## Evidence trail

PM read `AGENT.md`, `AGENTS.md`, `README.md` and `docs/architecture.md`, inspected
Git status/log/diff, and refreshed the task roster on September 20. Recent turns
were empty in the task reader, so PM read the corresponding local task transcripts
for Engineer, Architect, Design Engineer, Team Manager, Product Strategist and
Hackathon Analyst. These establish reported outcomes and requests; they do not
independently reproduce tests. UX proposal status was also confirmed in task output.

## Current evidence and remaining review

| Slice | Evidence | Next action / owner | Completion gate |
| --- | --- | --- | --- |
| Workspace access | SWE reported 16 focused workspace/document/paragraph tests. Architect independently ran four WorkspaceAccess tests; initial presence-generation and explicit card-role defects fixed. | SWE: private presence join/publish/revocation and successful workspace History lifecycle tests; Architect rereview. | All private entrypoints enforce membership; allowed paths work; live Google sign-in and provisioning verified. |
| Frontend modules | Design completed dashboard, workspace shell/panel/paragraph link, sources, inbox/send review, admin and agent context/changes presentation modules. SWE owns route/controller binding. | SWE binds real APIs; Design handles presentation fixes; UX reviews actual app after integration. | Runnable integrated surfaces, not fixture-only success. |
| Visual review | PM saw readable canvas/document split at 1280×720. UX found readable default fixtures without horizontal overflow; identified reply-to-main fixture callback and close-focus defects. Design fixed both, reports keyboard checks at 1440/390, build and 187 tests passing. Full check still formatting failures in concurrent work/generated guidance. | UX independently passed both fixes at 1440×900 and 390×844. Design fixed fixture draft/preview mismatch and heading spacing, verified at 1440/390; production editor typography still unverified. SWE uses panelReturnFocus=inbox for replies; onMainDocument selects canonical main identity and opens panel. | Visual report with exact checked scope, no focus loss or misleading send state. |
| Paragraph links | Canonical IDs initialized for new private docs; server validates client-submitted steps without silently rewriting ACKs. Architect withheld stability sign-off. | SWE adds concurrent split/rebase, actual editor undo/redo, deleted-link non-reattachment and continuity proof. | Stable paragraph-level references demonstrated across clients/edits, missing targets honest. |
| Agent/MCP | SWE reports three focused tests: immutable replay/stale conflict/revocation; delegated undo preserving another user's later paragraph; unsafe intersecting undo refusal/rollback. Stateless HTTP MCP drafted. | Architect independently passed the three focused internal-function tests; still reviews transport/authority/recovery. SWE must test HTTP MCP lifecycle; SWE tests actual MCP interoperability and UI context/review wiring. | F4–F6 proven through transport and concurrent human/editor behavior, not only direct mutation tests. |
| Sources | Firecrawl source and AgentMail inbox/send modules now exist; Architect provider review dispatched. No live calls or validation sign-off yet. | SWE validates adapter/state outcomes and binds cards. | Both one-URL main content and prompted extraction work; errors/source state visible. |
| Inbox/send | SWE reports inbox reads and immutable send intents implemented; fake-provider tests in progress, no live verification. | SWE implements and tests, Architect reviews immutable send intent/idempotency, Design/UX validate assembled UI. | Thread→canonical collaborative draft→reviewed send flow with honest pending/sent/failed/unknown states; no real emails sent during development. |
| Provider credentials | Keys absent in checked process/env files; local deployment credential presence not established. PM asked Chris for location only; no reply yet. Local codegen target verified port3210. | SWE continue independent work; verify configured names without exposing values. | Live provider checks only with existing configured credentials; mock evidence clearly labeled. |

### Presentation handoff

Design owns workspaces/{DashboardPage,WorkspaceLayout,MainDocumentPanel,
DocumentParagraphLink}, sources/SourceCard, inbox/{InboxPanel,SendReview},
admin/AdminPage, agentAccess/{AgentContextPanel,AgentChangesPanel}. SWE owns new
WorkspaceRoute/DashboardRoute/AdminRoute/CanvasScope and old controller/router bindings.
SendReview's `uncertain` maps backend unknown outcomes; reviewed text/version and
recipients are immutable send inputs. Keep canonical editor mounts and explicit presence.

Fixture-only preview: http://127.0.0.1:5181/?view=workspace, with dashboard/reply/
source/inbox/admin/agents variants. Restart: `python3 -m http.server 5181 --bind
127.0.0.1 --directory /tmp/presentation-preview`. It proves presentation only.
Owner reports seven views checked at 1440×900, 1024×768 and 390×844. Independent UX report completed: seven default views at desktop/narrow, workspace also 1024×768; no page overflow. Fixture scrolling, source unavailable, empty agent context, fixture Undo/admin switches/uncertain send checked. Loading/denied, dark mode, zoom, auth, links and live collaboration not verified. Real provider, auth and multi-user behavior remain separate gates.

### Coordination incidents

Specialist notifications sometimes fail automatic approval review. PM reads task
outputs and relays within Chris's explicit coordination authorization; no repeated
confirmation needed for those recovered handoffs.

Architect relayed a September 18 deletion-explanation request as new. PM verified
the original user-message timestamp, corrected precedence to September 20 overnight
authorization, and SWE explicitly confirmed resumption without changing deletion
lifecycle. Architect current assignment remains read-only agent/MCP review.

Evidence is attributed: PM independently checked Git/savepoints and one fixture view;
Architect independently ran access tests; other test/build reports above are owner
reports. No subsequent commits, pushes, deployments, purchases or real email sends.

Agent review found two required fixes, relayed to SWE: delegated undo only protects
text nodes and can erase a human-inserted line break; accepted edit replay checks
generation before receipt lookup and fails after delete/restore. Architect verified
the structural mapping reproduction. Keep current authorization on retries, but
separate accepted receipt replay from new-write generation validity. Regressions and
rereview required; MCP HTTP/client checks still pending.

Design Engineer now assigned bounded read-only actual-route inspection (dashboard,
workspace panel/editor typography, admin/denied/loading) with fixes only in owned
presentation modules. SWE retains controller ownership. Auth/provisioning blockers
must be reported honestly; no fixture substituted for integrated behavior.

PM inspected current WorkspaceRoute: main editor is bound, inbox action still opens
that same panel, and source/agent UI is not yet bound. This is an in-progress gap,
not completion. PM requested SWE explicitly release WorkspaceRoute/new provider-agent
binding controllers to Design Engineer to parallelize integration. No ownership
transfer until SWE confirms paths; Design remains read-only on those files meanwhile.

### Latest review findings

Actual frontend confirmed at http://127.0.0.1:5173. Design independently observed
signed-out dashboard incorrectly claiming account-ready/unassigned, workspace sign-in
prompt without navigation, and /admin missing. Code snapshot: inbox still main-panel
placeholder, account-query failure stuck loading, embedded 100dvh canvas may clip,
and actual editor has nested border/padding unlike fixture. Signed-out browser blocks
authenticated visual review; no identities/membership were created. PM relayed to SWE
and requested explicit route-controller release to Design before parallel edits.

Architect independently passed four provider tests but withheld sign-off: uncertain
send needs evidence-based recovery; reply defaults must respect direction/reply_to
and avoid own mailbox; reviewed reply message must be pinned; source refresh must
not label old capture with new URL/prompt. Dispatch-after-revocation coverage also
required. PM assigned all to SWE. No real provider calls or sends.

### Confirmed frontend ownership transfer

SWE explicitly released, and PM assigned to Design: workspaces/WorkspaceRoute.tsx,
WorkspaceTools.tsx, DashboardRoute.tsx; admin/AdminRoute.tsx; NEW feature-binding
controllers/hooks in sources/inbox/agentAccess. SWE stops editing those paths and
retains Router/App/CanvasPage/CanvasScope/existing protocol hooks/backend/core/config.
Design completes source/inbox/draft/send/context/grant/undo/link UI using generated
APIs. Account failure/sign-out states and login navigation included. Backend adds
AgentAccess.connectionInfo for actual HTTP origin. Paragraph selections retain their
observed version. PM forwarded exact API handoff and provider-contract caveats.

SWE reports six agent tests passing, including structural-undo refusal and retry
after generation change; Architect independent rereview dispatched. No transport
sign-off yet. Provider findings remain open until fixes/review evidence arrives.

Backend contract deltas relayed to Design: frozen Inbox.review includes
reviewedMessageId, required by Inbox.send; explicit Inbox.reconcile(threadId)
checks provider evidence without resending and leaves unknown unresolved absent
positive evidence; source refresh clears old capture; AgentAccess.connectionInfo
now returns actual HTTP URL. SWE reports /admin route registered. Fixes still need
tests and independent review before being marked verified.

Architect independently passed six agent tests and verified line-break undo refusal
and accepted replay after actual deletion/restoration. Related remaining defect:
human paragraph→heading conversion on an agent-created ID can still be erased by
undo. PM assigned structural-change guard/regression to SWE; no final F6 sign-off.
