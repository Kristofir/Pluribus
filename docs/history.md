# History

Personal History reverses accepted Canvas actions. Canonical Elements remain the
source of truth; editor text History remains separate.

## Coverage and interface

| Operation                | Canvas History                                  |
| ------------------------ | ----------------------------------------------- |
| Create or delete Element | One entry per Element                           |
| Move or resize Elements  | One entry per gesture; group reversal is atomic |
| Edit text                | Separate editor Undo/Redo                       |
| Automatic content height | Unrecorded; may conflict with geometry Undo     |

```ts
history.perform(action);
history.undo();
history.redo();
history.retry();
const gesture = history.beginGesture(targets);
gesture.update(changes);
gesture.end();
gesture.cancel();
```

New accepted actions clear Redo; no-ops and rejected actions do not. Capacity
blocks preserve the entry; obsolete inverse actions retire it. Canvas exit,
reload or account change clears personal stacks. Mixed deletion stops at the
first failure and preserves earlier accepted entries.

## Acceptance and retries

- Commit canonical changes, action state and required evidence atomically.
- Session capabilities bind actions to one mounted Canvas and authenticated owner
  or guest capability. Separate tabs never share personal History authority.
- Durable apply/Undo/Redo/close attempts bind an immutable ID and request fingerprint.
  Exact retries return the original outcome even after a collaborator changes state.
- Acceptance and present reversibility are separate. New inverses revalidate state.
- Unknown responses retry the same attempt. Known capacity blocks use a new attempt
  when retried. Authentication/validation rejection never becomes a network retry loop.
- Store failed-attempt outcomes only for deduplication; they are not accepted edits.

## Lifecycle continuity

- Creation Undo soft-deletes; Redo restores the same Element and saved content.
  Deletion Undo restores; Redo removes again with a fresh deletion identity.
- Advance editing generation on every removal/restoration. Old writes, editor
  sessions and text-undo proofs remain invalid.
- Each session/Element has a lineage and current generation. Own verified lifecycle
  transitions advance both Element and binding without changing lineage. Earlier
  actions can therefore survive personal delete/restore cycles.
- Peer lifecycle changes leave the binding stale. Only a new forward action can
  establish a new lineage; Undo/Redo cannot renew old authority.
- Restore requires the exact active deletion identity, generation, lineage, action
  revision and available capacity. Keep canonical text, attribution and geometry.
- Block local removals, including inverse retries, while text is pending. Remote
  removal keeps the existing pending-text recovery flow; never replay it automatically.

## Geometry protocol

- Capture authoritative starting geometry, target set, write generations and lineage
  on the first accepted batch. Keep one sender and one request in flight per gesture.
- Coalesce updates at 50ms. Retain one latest-sequence fingerprint/ACK in the action,
  not a permanent attempt row per pointer update. Older sequences return superseded;
  the latest exact duplicate returns its ACK even after a peer edit or closure.
- Live updates never adopt a restored generation. Inverses use verified session
  continuity and require every target's expected whole geometry to match.
- End submits final intent then closes. Cancel discards unsent previews, reconciles
  in-flight work and closes accepted geometry; it does not revert shared movement.
- Close is a separate durable attempt. It seals evidence without writing geometry.
  Unknown action closure is rejected; empty local gestures need no backend close.
- Idle closure uses a 30s lease and 10s active heartbeat. One scheduled checker per
  action reschedules only when necessary. Duplicates do not renew leases. Hidden,
  disconnected or disposed clients stop heartbeats. Closed gestures never reopen.
- Teardown makes a best-effort close without reviving UI state; idle closure covers
  hard disappearance. A returning frozen client discards unsent positions.

## Ownership, bounds and compatibility

- `History.ts`: personal ordering/retry controller. `ElementHistory.ts`: compact
  facade. Typed transport handlers and the gesture queue hide protocol bookkeeping.
- Core application handlers own action and continuity rules. Convex adapters own
  credentials, indexed storage, scheduling and transactions.
- Four V2 tables: sessions, typed actions, durable attempts, session/Element bindings.
  Reads expose sanitized summaries; applicability is advisory and never authorizes a write.
- Geometry operations permit at most 202 targets and 128 KiB normalized payloads.
  Reject oversized groups rather than partially applying them. Work scales with
  target count; no global Canvas sequence or History scan.
- Legacy endpoints/receipts retain their original behavior. New Canvas sessions use
  V2 exclusively. Legacy lifecycle changes invalidate V2 continuity; legacy recovery
  cannot restore V2 deletions. No receipt conversion or content migration.

Action, attempt, session, binding and deleted-content retention remains unbounded.
Bounded stream cursors do not make total storage bounded. Automatic purge, persistent
personal stacks, grouped deletion and future action kinds require separate decisions.

## Workspace and agent scope

Canvas sessions belong to one workspace and owner; every write rechecks membership.
Main/reply panel children have no spatial actions. Agent text groups use a separate
initiator-only Undo endpoint: accepted text and evidence commit atomically, and
mapped inverses refuse changes that would erase another writer's text or structure.
No agent Redo is implemented. See [Workspace prototype](workspaces.md).

Rectangles are retired. Retained receipt formats remain readable for protocol
compatibility, but new actions and historical inverses cannot mutate or revive
rectangle rows. Active Element operations target document cards and Web Pages.

Web Page creation through Add web page, movement/resize and deletion use the same
personal Element History. Undo restores the retained source row/capture without
refetching. Refresh is not an Undo operation: it replaces the capture only after
success. Legacy Sources.request callers remain a capture API without a personal
creation stack; the product creates cards through Canvas History.
