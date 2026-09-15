# Prototype register

Test uncertain concepts in small, isolated experiments before combining them.
This is a research plan, not an implementation queue or an accepted architecture.
All prototypes below are unstarted. Recorded 2026-09-14.

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

**Deferred:** the formal state machine and final conflict policies. Same-object
experiments may later compare simultaneous manipulation with temporary reservation;
neither is selected now. Canvas SDK choice also remains open.

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

| ID                                 | Question                                                            | Small experiment and evidence                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P02 — Human and AI edits           | Can proposed changes preserve intervening human edits?              | Use a delayed, simulated AI response. Edit its target before applying, test overlapping proposals and duplicate application, and demonstrate safe apply or explicit conflict. Use fixed target blocks initially; repeat with P01 anchors later.  |
| P03 — Dependency changes           | Can we identify what actually becomes outdated?                     | Connect sample sources to targets. Change content, move a card, add/remove an input, and try a cycle. Record the expected affected targets; positioning alone must not trigger regeneration. Test an input changing while a proposal is pending. |
| P04 — Web source capture           | Can a URL become usable, traceable source material?                 | Import one public page, preview it, and extract a small result from a prompt. Test failure, retry, refresh, and a late response. Results identify the capture used; refresh preserves user-edited derived content.                               |
| P05 — Canvas and document sessions | Can multiple editable elements coexist reliably on a shared canvas? | Use two clients to move, edit, and delete sample elements. Test undo, reload, and an editor moving offscreen with pending edits. Verify content survives and deleted elements are not resurrected. Canvas SDK choice remains open.               |

## Integration experiment — after individual proofs

Connect a web capture to an anchored passage, change the source while someone
edits the passage, and review the resulting proposal on a shared canvas. Also
delete the target or revoke access while work is pending. Verify that stale work
cannot overwrite newer edits, restore deleted content, or bypass current access.
Record which individual assumptions held when combined and which need revision.
