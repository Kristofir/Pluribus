# Prototype register

Test uncertain concepts in small, isolated experiments before combining them.
This is a research plan, not an implementation queue or an accepted architecture.
P00 is implemented and mechanically verified locally; its two-person usability
exercise remains pending. Collaborative text, presence, and the bounded P05 embedding experiment are also implemented. Updated 2026-09-16.

**First experiment: P00, the multiplayer canvas.** Explore basic shared interaction
before text collaboration or anchoring. IDs identify experiments, not a required
execution sequence for everything that follows.

See the [shared canvas model](canvas-model.md) for product context and the
[architecture contract](../architecture.md) for implementation boundaries.

## How we work

- Give each experiment one question and a small, visible test surface.
- Use sample content and simulated services when they can answer the question.
- Write expected behavior before testing; distinguish product choices from bugs.
- Record reproducible steps, observed results, limitations, and the decision:
  adopt, revise, or discard. A working demo alone is insufficient evidence.
- Combine successful experiments afterward and test their interactions. Prototype
  success does not automatically make its code or storage design production-ready.

## P00 — Multiplayer canvas basics

**Question:** Does adding and manipulating shared objects feel understandable
and responsive for two people?

**Smallest surface:** two clients, one canvas, one element type: a colored
rectangle. Each person can add, select, drag, resize, and delete rectangles.
Pan, zoom, and selection remain personal. Other participants see live movement
during a drag, not only the final position. Confirmed shared state survives reload.

**Participation:** anonymous clients enter the same prototype canvas directly,
with no sign-in, accounts, workspace membership, or permission flows. Temporary
per-client session IDs distinguish participants for testing; they are not an
authentication mechanism. This scope applies to P00, not the application's auth
architecture. It does not require removing existing authentication code.

1. **Try the basic interactions.** Add, drag, resize, and remove rectangles from
   either client. Check that both settle on the same shared state after changes.
2. **Work independently.** Move different rectangles at the same time; observe
   responsiveness and whether either person's activity interferes with the other.
3. **Explore collisions.** Grab the same rectangle simultaneously, then delete a
   rectangle while the other person drags it. Record what happens and what people
   expect. Deleted elements must not return because an old drag completes.
4. **Reload.** After changes are confirmed, reload each client and verify the
   surviving elements and their positions and sizes.
5. **Try a shared task.** Ask two people to arrange rectangles into three clusters
   without explaining the controls. Note hesitation, accidental interference,
   and whether they understand the other person's actions.

**Evidence:** repeatable interaction cases, observations from both clients, and a
comparison of their final state and state after reload. Record whether live
movement feels smooth and whether concurrent manipulation is understandable.

**Implementation:** React Flow 12.11.6 plus the existing local Convex backend,
at `/canvas`. P00 remains a research label, not a runtime feature boundary.
The only new persisted model is `rectangles`: position, size, color,
and Convex system fields. No Canvas, User, or Workspace model is introduced.
Geometry updates coalesce at 50 ms intervals during gestures, with an immediate
final flush once any in-flight update completes. The latest server-accepted
geometry wins. Simultaneous manipulation remains enabled; no reservation.

**Deferred:** the formal state machine, final product conflict policy, and
long-term SDK adoption. Later experiments may compare temporary reservation.

### P00 evidence — 2026-09-15

Two independent Chromium contexts against the local backend passed these cases,
including a replay after the core/use-case/adapter and Zustand refactor:

| Repeatable case                                                           | Observed result                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Add in either client; select and drag                                     | Both see the record; remote position changes before mouse release; selection stays local         |
| Resize from the top-left handle                                           | Both position and size update live and converge after release                                    |
| Drag separate rectangles simultaneously                                   | Both changes survive and clients agree                                                           |
| Grab the same rectangle in both clients, move, release                    | Both settle on the same geometry; this does not establish that interference feels understandable |
| Delete from one client during the other client's drag; release and reload | The rectangle stays deleted                                                                      |
| Reload both clients after Saved                                           | Confirmed position and dimensions are preserved                                                  |
| Pan/zoom in one client                                                    | The other viewport and shared geometry stay unchanged                                            |
| Put one browser offline, then reconnect                                   | Editing pauses immediately and recovers; unsent overlays are discarded                           |
| Delete with keyboard; navigate home/back and to an unknown URL            | Deletion and typed route recovery work; Google sign-in remains present on home                   |

Backend and controller tests cover geometry rejection without partial writes,
capacity, final-update flushing, slow acknowledgements, deletion cancellation,
and disconnect/reconnect. This is an online-only prototype: already-submitted
Convex mutations may complete after reconnection. It supports up to 200 rectangles,
sizes 40–2000, and coordinates within ±100000. No latency benchmark or production
scale test was performed. Google OAuth was not repeated end-to-end in this run.

**Decision:** continue hands-on evaluation in the evolving canvas feature. Its
implementation now follows the core/use-case/adapter architecture and uses a
feature-scoped Zustand store. The conflict policy remains provisional. The two-person
three-cluster exercise and qualitative smoothness/interference observations remain
pending; browser automation does not answer the usability question.

**Outside this experiment:** text editing/collaboration, AI, source connections,
grouping, undo/redo, offline support, and a generalized element framework. P05
later examines document sessions on the canvas once the basic interaction works.
P00 does not validate authorization or isolation between workspaces.

## P01 — Content anchors in collaborative text

**Question:** Can a source connection keep pointing to the intended content as
people edit it, including simultaneous edits?

**Candidate model:** structured blocks inside one collaborative ProseMirror
document, with stable block identities. Content anchors identify whole blocks or
ranges within/across blocks. Source connections separately record the source,
purpose, and update policy. Stable block IDs alone do not solve range anchoring.
Anchor storage and the editor choice remain open.

**Smallest surface:** one document with several paragraphs and a list, a fake
source, and visible anchor highlights/status. No canvas, crawling, or live AI.
Do not make each paragraph a separate database record or synchronization session.

1. **Create sample content.** Include repeated sentences so matching by text alone
   cannot accidentally appear reliable. Display block identities for inspection.
2. **Connect selections.** Anchor a sentence, a whole paragraph, and a range across
   paragraphs. Add overlapping connections; selecting one highlights its target.
3. **Specify edge behavior.** Decide whether insertion at each boundary extends
   the range, what copied content inherits, and what deletion/undo should do.
   Record these as provisional expectations before choosing an anchor mechanism.
4. **Exercise ordinary editing.** Insert before, inside, and at both boundaries;
   replace part/all of a range; split/merge paragraphs; move, copy/paste, delete,
   undo, and redo. Check identity uniqueness and every connection after each step.
5. **Exercise collaboration and reload.** Repeat representative cases with two
   clients editing concurrently. Include a simulated AI replacement, concurrent
   anchor creation/deletion, and reload after confirmed synchronization. Check
   that content, identities, and connections agree across clients and restoration.
6. **Record the evidence.** Keep an operation/expected/observed table and repeatable
   failing cases. Compare candidate anchor mechanisms if needed, then recommend
   storage and editing rules, or explicitly leave them unresolved.

**Pass criteria:** supported operations preserve the intended target and converge
across clients. Deleted or unresolvable targets become visibly invalid rather than
silently attaching elsewhere. Copying and undo follow the recorded policy. Reload
preserves confirmed connections. Unsupported cases and tradeoffs are documented.

**Does not prove:** that a syntactically intact connection still provides valid
evidence after a sentence changes meaning, or that an AI rewrite is appropriate.

## Other candidate experiments

These are proposals to prioritize separately, not commitments to build them now.

| ID                                 | Question                                                         | Small experiment and evidence                                                                                                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P02 — Human and AI edits           | Can proposed changes preserve intervening human edits?           | Use a delayed, simulated AI response. Edit its target before applying, test overlapping proposals and duplicate application, and demonstrate safe apply or explicit conflict. Use fixed target blocks initially; repeat with P01 anchors later.  |
| P03 — Dependency changes           | Can we identify what actually becomes outdated?                  | Connect sample sources to targets. Change content, move a card, add/remove an input, and try a cycle. Record the expected affected targets; positioning alone must not trigger regeneration. Test an input changing while a proposal is pending. |
| P04 — Web source capture           | Can a URL become usable, traceable source material?              | Import one public page, preview it, and extract a small result from a prompt. Test failure, retry, refresh, and a late response. Results identify the capture used; refresh preserves user-edited derived content.                               |
| P05 — Canvas and document sessions | Can child document elements coexist reliably on a shared canvas? | Place two document elements inside one canvas. Use two clients to move cards and edit their text. Test presence in both contexts, undo, reload, deletion, and moving offscreen with pending edits. Geometry and text synchronize separately.     |

## Integration experiment — after individual proofs

Connect a web capture to an anchored passage, change the source while someone
edits the passage, and review the resulting proposal on a shared canvas. Also
delete the target or revoke access while work is pending. Verify that stale work
cannot overwrite newer edits, restore deleted content, or bypass current access.
Record which individual assumptions held when combined and which need revision.

## Collaborative text — prerequisite to anchors and canvas embedding

Implemented at `/document` using Tiptap and Convex ProseMirror Sync. One anonymous
shared document has paragraphs, headings, bold, lists, and editor-owned undo/redo.
Application metadata and content initialize atomically. Content uses incremental
steps and periodic snapshots; no paragraph records or separate paragraph sessions.

Backend integration tests verify separate-paragraph and same-sentence concurrency,
range deletion versus insertion, per-client undo, snapshot/reload reconstruction,
duplicate initialization, and rejection of invalid versions, steps, and snapshots.
In the tested overlapping deletion case, the insertion inside the deleted range is
removed during rebase; undo restores the original deleted text, not that discarded
insertion. This is observed conflict behavior, not an intention-preservation guarantee.

Editing is online-only. Disconnection pauses input; pending changes remain in the
mounted editor. In-app navigation blocks pending edits, and closing the tab warns.
No durable offline recovery, sources, anchors, AI, or canvas embedding.
Human evaluation of conflict behavior remains open. The original P01 anchor
experiment and the later canvas-editor interaction experiment remain separate.

Browser verification with isolated clients confirmed concurrent insertions, undo
preserving the peer contribution, reload agreement, pending-navigation blocking,
saved navigation, offline input pausing, and reconnect. Temporary test edits were
undone where possible; pre-existing user content was preserved.

## Presence — implemented independently on canvas and document

Canvas shows remote pointers, selections, and drag/resize activity. Documents show
remote carets and ranges. Both group browser guests with tab counts and away state;
the activity toggle changes display only. Membership expires through the official
Convex component. See the architecture contract for lifecycle and mapping rules.

Tests cover capability/context isolation, independent channel ordering, prioritized
clears, duplicate leases, multiple contexts, late joins, pending text coordinates,
deletion/rebase ambiguity, and real component expiry. Browser checks cover grouped
tabs, pointers across zoom, selection without changing local selection, manipulation,
text carets/ranges, undo, reload identity, pending-navigation blocking, activity
toggling, resize indicators, and offline/reconnect. Simulated visibility
changes verified away, hidden activity, expiry, and fresh return; this is not an
OS-background-tab test.

A local delayed-acknowledgement typing run reached six pending steps and converged
to the writer's confirmed caret. It produced 15 writer presence updates, zero passive
viewer presence writes, zero viewer roster updates, and 15 viewer activity updates.
The measured sockets carried 46,058 additional payload characters including text
sync traffic. A separate pointer observation took 177 ms including automation.
These small-cohort observations are not isolated presence costs or latency percentiles;
other local clients were connected. The 64-session bound is not load-tested capacity.
Human usability, larger cohorts, and OS background throttling remain unverified.

## P05 evidence — 2026-09-16

Implemented two canvas-owned document cards alongside existing rectangles. Card
geometry uses canvas synchronization; text retains Tiptap/ProseMirror Sync. Both
editors remain mounted offscreen, with document presence acquired only for editing.
Removed cards become recovery placeholders with Restore; removed children count
toward the two-card limit. Saved text persists. Pending local text remains only in
memory, can be copied as JSON, and is never automatically replayed after restoration.

Component-backed tests verify child/text creation rollback, the retained-child cap,
text isolation, ownership rejection, and stale geometry/text/snapshot/presence writes
after removal and restore. Browser checks with independent clients verified typing
while another client moves the card, stable editor identity, text isolation, undo,
remote removal with delayed submissions, recovery-copy retention, stale-write
rejection after restore, and reload/reconnect. Holding submissions explicitly also
verified offscreen editor lifetime, local-removal blocking, pending-navigation
blocking, and undo after saving. A final two-client check confirmed separate
document participation while canvas membership stays active. Temporary test text
was undone or removed.

This is an online-only, anonymous, two-document experiment. It does not validate
workspace isolation, many-editor performance, permanent deletion, durable recovery,
source anchors, or cross-canvas reuse. Human evaluation of focus and recovery remains
open. The standalone document surface remains available.

### Presence policy follow-up — 2026-09-16

Handlers now emit events into a pure core policy. Blur retains the last activity;
hidden tabs retain accepted activity until membership expires, then rejoin fresh.
This supersedes the earlier hidden-activity behavior above. A two-client local
browser check verified editor blur, simulated window blur/visibility, continued
unfocused heartbeats, hidden expiry and return without changing document content.
A stale-editor attachment race was also reproduced and fixed; passive viewers no
longer depend on receiving a local editor event before showing remote carets.
Actual operating-system background suspension remains unmeasured.

## Current-text authorship — accepted experiment

**Question:** Can two writers see who authored surviving text without trusting
client attribution or duplicating the document's synchronization engine?

**Status:** authorship now runs in canvas document cards, including **Show authors**
and explicit moves. `/document` redirects to `/canvas`. The cases below define
acceptance; historical protocol evidence and canvas verification follow.

| Case                                      | Required behavior                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| Type or replace another author's text     | New text belongs to the writer; surrounding text keeps its author                |
| Format text                               | Attribution stays unchanged                                                      |
| Paste attributed content                  | Ordinary paste belongs to the person pasting                                     |
| Explicitly move text within the document  | Text retains its original attribution                                            |
| Undo/redo while another writer edits      | Verified restoration preserves attribution and clients converge                  |
| Submit forged marks or restoration claims | Backend rejects them without committing text or evidence                         |
| Reload legacy and attributed content      | Legacy text stays unknown; accepted attribution persists                         |
| Remove and restore a canvas card          | Saved attribution survives; old-generation sessions and undo claims are rejected |

Guest attribution identifies a durable credential holder, not a verified human.
No AI integration, source anchors, durable offline recovery or full revision-history
interface is included. Retained operation evidence supports verification; it is
not itself a product commitment to permanent history or unlimited undo.

### Storage and scaling measurements

Compare roughly 1 KiB of one-author prose, realistic interleaved edits and a labelled
fragmentation stress case. Report UTF-8 serialized bytes for plain text, equivalent
unattributed structured content and attributed structured content, with span counts
and absolute bytes alongside ratios. Account for author records, retained operation
evidence, steps and snapshots separately. Transport compression is a separate
measurement, not an assumption about storage. Do not invent a size budget or discard
attribution to meet one.

Record the operation adapter's rebasing/undo/move proof, backend rejection cases,
two-client browser results, architecture/type/test/build outcomes and limitations
here before calling the experiment verified.

### Initial storage observations — 2026-09-16

Backend fixtures serialize generated documents, author records and accepted
operation receipts as UTF-8. The first three fixtures use repeated characters;
the interleaved case alternates authors every 32 characters. A separate mixed
trace exercises two writers, replacement and undo, formatting, moving another
author's text and undoing the move, then appending text. These are repeatable
fixtures, not captured user sessions. Generated IDs/timestamps can change record
totals by a few bytes.

| Fixture                                        | Plain text | Unattributed JSON | Attributed JSON | Text spans | Attributed / unattributed JSON |
| ---------------------------------------------- | ---------: | ----------------: | --------------: | ---------: | -----------------------------: |
| One author, 1,024 characters                   |    1,024 B |           1,109 B |         1,195 B |          1 |                          1.08× |
| Two authors, alternating 32-character runs     |    1,024 B |           1,109 B |         4,667 B |         32 |                          4.21× |
| Stress: two authors alternating each character |      512 B |             597 B |        57,915 B |        512 |                         97.01× |
| Mixed edit trace                               |      107 B |             244 B |           630 B |          4 |                          2.58× |

| Fixture                       | Author records | Session records | Accepted operation evidence | Canonical step JSON |
| ----------------------------- | -------------: | --------------: | --------------------------: | ------------------: |
| One author                    |          194 B |           245 B |                       377 B |             1,272 B |
| Alternating 32-character runs |          383 B |           485 B |                    12,086 B |             9,078 B |
| Per-character stress          |          383 B |           489 B |                   193,733 B |           129,320 B |
| Mixed edit trace              |          387 B |           489 B |                     5,350 B |             2,827 B |

Fragmentation has substantial cost: short alternating-author spans cannot merge
without losing attribution. These results establish neither constant overhead nor
a production capacity. Current JSON is one snapshot payload, not accumulated
snapshot storage. Step totals measure UTF-8 step JSON strings without outer
container/string escaping. Component row/index overhead, physical database storage
and transport compression are excluded. Full retained snapshot accounting and
production editing workloads remain unmeasured.

### Authorship behavior evidence — 2026-09-16

Six focused tests pass, covering marking, rebased undo/redo, atomic rejection of
forged attribution and explicit moves. Moves and their restoration must include
both removal and insertion: accepting only the restoration half could duplicate
another author's text. Receipts bind restoration to the same actor, editor session
and generation; retaining receipts does not make undo survive an editor reload.

Two independent live clients verified typing, formatting, deleting another
writer's text and undoing it, explicit move and undo, authorship display, and
reload. The original document content was restored after the check. Broader
validation passed: 91 tests, frontend/backend/core type checks, architecture checks
over 174 authored files, and build. Formatting retains only the pre-existing
generated Convex guidance warning; build retains the existing large-chunk warning.
A focused backend rerun also verified whole-move redo and consumed-proof rejection.

Ordinary edits checkpoint canonical content after acceptance. Undo still reads
intervening steps from its accepted operation, so old undo can grow with history;
this is not a constant-cost guarantee. Sessions/evidence are retained without an
expiry policy in this prototype. Large author cohorts, long histories, background
retention cost and adversarial production load remain unverified.

### Canvas integration evidence — 2026-09-17

Document cards now use the shared authored editor. The standalone page and loader
are removed; `/document` redirects to `/canvas`. Concurrent card mounts retain one
guest identity and open separate generation-scoped editing sessions. Backend tests
verify attributed content survives removal/restoration, with cross-card credentials,
old generations and old-session undo claims rejected.

Two independent browser clients edited both existing cards, verified the same guest
across cards, restored another writer's text with undo, enabled author highlights,
and reloaded matching content. Temporary test text was removed and original content
restored. All 93 tests, architecture checks and typechecks pass; production build
passes with a chunk-size warning. Formatting retains the pre-existing generated
`convex/_generated/ai/guidelines.md` warning.
