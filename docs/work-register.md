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
| Coordination savepoint | Project Manager | Commit this register now that code savepoint released Git. | Separate documentation commit SHA. Pending. |
| Modular architecture and contracts | Architect / Software Engineer feasibility consultation | Read-only proposal of ownership, dependencies, edit semantics and access boundaries. | Concrete frontend/backend contracts sent to PM and Engineer. In progress. |
| Backend readiness | Software Engineer / Architect | Read-only inspect existing foundations and credential names/presence, never values. | Integration blockers and scoped ownership proposal. In progress. |
| Frontend implementation | Design Engineer / UX Designer visual review and Architect boundary review | Await savepoint and agreed contracts; retain current Intent UI conventions. | Runnable assembled screens plus browser behavior and visual evidence. Not dispatched. |
| Backend/core implementation | Software Engineer / Architect | Await savepoint and contracts; own backend/core and shared registration/config changes. | Relevant tests, integration evidence and independent review. Not dispatched. |
| Visual acceptance | UX Designer / Chris final design tomorrow | Read-only checklist now; inspect assembled UI when ready. | Concrete findings on hierarchy, spacing, readability, states and canvas/document relationship. Dispatched. |

No agents may overlap edits. PM owns this register. Engineer and Design Engineer
must agree shared files before editing. Architect and UX Designer review read-only.
Independent review is separate from owner-reported tests; external provider behavior
requires real evidence, and unavailable checks remain explicitly unverified.

### Existing implementation handoffs

| Item | Owner / reviewer | State and evidence | Next action | Completion criteria |
| --- | --- | --- | --- | --- |
| Session-scoped Element History | Software Engineer / Architect | Approved, implemented, reviewed, committed as `6db7bfb`. Architect's latest review reports all three findings resolved. Engineer reports 176 tests passing with longer timeout, types, architecture, build and browser checks. PM independently confirmed commit and Git state, not runtime behavior. | No implementation handoff remains. Keep release separate; push only when Chris requests it. | Implementation/review complete; any later release needs explicit authorization and its own evidence. |
| Editor recovery, focus and drag-status fixes | Design Engineer / Software Engineer proposed for integration review; Architect if a boundary issue arises | Implemented, uncommitted. Latest drag fix explicitly requested by Chris. Agent reports browser checks, six projection tests and build passing; latest full check reports 175 passing tests and two architecture fixture timeouts. No independent review of this diff found. Evidence: current diff, Design Engineer task, latest entries in canvas behavior and hackathon log. | PM to coordinate a read-only review after orientation, scoped to the existing fixes; keep Design Engineer as sole implementation owner. No review dispatched yet. | Reviewer checks focus/recovery and History interaction against behavior requirements; findings resolved by owner; validation outcome and limitations recorded. Commit/push/deploy remain separate decisions. |
| Recurring architecture fixture timeouts | Project Manager owns triage handoff; technical owner not assigned (Software Engineer proposed), Architect proposed reviewer | Observed validation gap, not an approved repair assignment. Engineer reports success with longer timeout; Design Engineer's latest full check still times out on two fixtures. Cause not established. | Define a bounded diagnostic assignment if Chris wants this pursued; do not treat longer-timeout success as a repair. | Reproducible cause and disposition, with default-check outcome documented; any repair has an approved scope and one implementation owner. |
| Design Technician availability | Team Manager / Chris for any new role creation | Unconfirmed. Team Manager's latest review could not locate a usable task after an earlier queued creation. | Leave coverage question with Team Manager; do not create a duplicate or route work to the pending setup ID. | Usable task ID and scope confirmed, or explicit decision that no separate role is needed. |

States are distinct: proposed, approved, implemented, reviewed, verified, committed,
pushed, deployed. A reported passing check is agent evidence, not independent PM
verification. No tests were rerun during this documentation-only orientation.

## Shared checkout and release state

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

All IDs below are on `local`; titles and states refreshed through task tools.
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
