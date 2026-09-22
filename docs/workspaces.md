# Workspace prototype

Private workspaces share the existing Canvas, editor, presence and History protocols.
`/canvas` remains a separate anonymous demo; `/workspaces/$workspaceId` requires
membership on every backend request. Google login alone grants no workspace access.

## Ownership

- `workspaces` owns membership, explicit verified-email assignments and a main document.
- `canvasDocuments` owns document lifecycle. Spatial cards have geometry; `main` and
  `reply` children do not consume spatial-card capacity; the main document is fixed canvas paper and replies remain panel editors.
- Each inbox thread owns one canonical reply child. Presentations reuse the same editor;
  switching presentation never creates another text copy.
- ProseMirror Sync owns canonical text. Paragraph IDs are node attributes, authored
  as ordinary steps; split/paste creates new IDs, verified Undo restores old IDs.
- Links bind Element IDs to document/paragraph IDs. Deleted anchors stay unresolved;
  similar replacement text never silently retargets a link.

## Document presentation

The main document uses one mounted editor on fixed, centered canvas paper; height
extends with its content. Main document recenters the top without fitting the full
length. Replies use a formatting toolbar above a scrollable, centered panel page. Controls share the mounted editor: Undo/Redo, paragraph and headings 1–3,
bullet/numbered lists, bold, italic and strikethrough. Toolbar actions preserve
text selection; read-only/paused sessions disable commands, and pending authored
changes disable history. Paragraph tools and reply review remain below the page.
The layout wraps on narrow screens and follows the selected theme. Canvas cards
retain their text-only presentation.

## Provisioning

Run `workspaces/Provisioning:provision` internally against the confirmed local
deployment with `{slug,name,assignments:[{email,admin}]}`. Use explicitly approved
addresses; never infer the first administrator. Verified Google users claim only
matching assignments through `Workspaces.claim`. Existing differing assignments
are refused. To deliberately approve admin for an existing assignment, the internal
`workspaces/Provisioning:authorizeAdministrator` command requires its workspace ID
and approved email; verified login then claims the role. Admin access is checked
independently of workspace membership.

Provider credentials stay in backend deployment environment variables:
`FIRECRAWL_API_KEY` and `AGENTMAIL_API_KEY`. Workspace provisioning queues one
AgentMail inbox automatically; `AGENTMAIL_INBOX_ID` is no longer required. Existing
workspaces enter the same flow through internal `inbox/Provisioning:ensure`.

The durable setup record stores a random `client_id` before calling AgentMail.
Retry reuses it after failure or timeout; revision guards reject stale completion.
A 60-second watchdog makes lost workers retryable. Binding checks prevent sharing
one inbox across workspaces. `Inbox.list.provisioning` exposes pending, provisioning,
ready or failed; members can call `Inbox.retryProvisioning`. The authorized
`Inbox.list.address` projection supplies the bound mailbox email, or null for an
opaque provider ID. Setup does not send mail.
The provider key must permit inbox creation; permission failure remains visible.

[AgentMail create contract](https://docs.agentmail.to/api-reference/inboxes/create)
and [idempotency contract](https://www.agentmail.to/docs/idempotency) define the
provider boundary. Never expose keys through frontend variables or logs.

## Sources and mail

A source request increments its revision and clears its previous capture. Only
that revision's result may publish. Firecrawl accepts one validated public URL and
an optional extraction prompt; network calls run in actions. Literal private hosts
are refused; DNS and redirect destination enforcement still depends on Firecrawl.

Inbox refresh reads at most 10 threads and 20 messages per thread. It preserves
canonical reply identity. Review defaults to the last incoming message's Reply-To
or sender; outgoing mail cannot become the reply target.

Send records immutable reviewed text, version, recipients and target message before
one dispatch attempt. A read-only submission lookup recovers the exact user/request
intent after a lost acknowledgement. Changed text or incoming target requires another review.
Dispatch rechecks membership. Timeout or ambiguous provider failure means `unknown`:
never retry sending automatically. Read-only reconciliation requires a sent provider
message with the exact intent header; absence cannot prove failure. A 60-second,
versioned claim lets a lost reconciliation worker be retried without resending.

## External agents

`AgentAccess.grant` issues a revocable bearer capability for explicitly selected
documents, tied to its initiating member. Context snapshots are bounded, versioned
selections, not authorization. `AgentAccess.connectionInfo` returns the MCP URL.

The stateless `/mcp` HTTP endpoint exposes `read_document`, `read_context` and
`edit_document`. Clients supply a bearer token and protocol `2025-06-18`.
Edits specify document generation, exact base version, a request ID and up to 20
paragraph insert/replace/delete commands. Exact retries return their original
outcome; stale versions conflict. No model or provider is chosen by the app.

Accepted text, attribution and operation-group evidence commit together. Human
Undo of an agent group is restricted to its initiator and current membership.
Mapped inverse validation preserves other writers' text and structural changes;
ambiguous inverses are refused atomically. Intervening formatting currently causes
a conservative refusal even when outside the edited range. Agent Undo remains
separate from spatial Canvas History; agent Redo is not implemented.

## Verification and limits

`WorkspaceAccess.test.ts` covers private read/write isolation, revocation, presence,
card capacity and History create/delete/undo. `ParagraphIdentity.test.ts` covers
concurrent split/rebase, merge with text edits, deletion with replacement paste,
and native editor Undo/Redo. These scenarios do not prove general concurrency safety. `AgentEdits.test.ts` covers
retry, conflict, anchor restoration and safe group Undo. `ExternalEffects.test.ts`
covers reviewed sends, revision guards, recovery leases and mocked provider HTTP.
`Mcp.test.ts` drives the registered HTTP endpoint through authentication and edits.
`InboxProvisioning.test.ts` verifies watchdog/revision guards and stable provider
identity after a lost accepted response.

A disposable client also passed against the actual local MCP server: initialize,
discover, read, edit, exact retry, readback and revoked-token denial. Its data and
temporary helper were removed. Credentials are configured locally. After replacing
a key that returned HTTP 403 `missing_permission`, AgentMail inbox creation succeeded
using the same persisted identity. The real bound inbox read passed with zero
threads/messages; no real send has been attempted. Live Firecrawl checks through the actual backend
adapter passed public-page main-content scraping and prompted JSON extraction; the
temporary internal helper was removed. Real authenticated browser
workspace verification uses the approved demo assignment and remains separate
from these provider-adapter checks.

Prototype limits remain explicit: 100 spatial document cards,
20 sources per workspace, 100 KB context snapshots, 1,000 intervening steps for
agent Undo. Personal Canvas stacks remain session-local; retained document and
operation evidence has no automatic purge. These are bounds, not scale guarantees.

Web Pages are spatial source Elements: cards subscribe to compact previews and the
read-only panel loads one full capture. Canvas History records creation/move/resize/
delete. Deletion frees a source slot, retains content and invalidates old provider
work; Undo does not refetch. Refresh and failed refresh preserve the previous capture
until a new result succeeds, including its original URL, prompt and capture time.
