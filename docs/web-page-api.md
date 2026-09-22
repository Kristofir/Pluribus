# Web Page capture API handoff

Backend contract for Design Engineer, September 21, 2026. No UI redesign is
included. All endpoints below require authenticated workspace membership.

## Reads and states

`api.Sources.cards({ workspaceId })` is the compact canvas projection;
`api.Sources.get({ workspaceId, id })` returns a full capture or `null` when
missing/removed/outside that workspace. `list({ workspaceId })` retains its
existing full-capture tool contract. All three expose:

| Field                                      | Meaning                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `id`, `canvasId`, `generation`, `geometry` | Existing identity and canvas lifecycle fields.                                        |
| `url`, `prompt?`                           | Latest requested URL and extraction instruction.                                      |
| `revision`                                 | Capture request version; separate from canvas generation.                             |
| `status`                                   | `queued`, `fetching`, `ready`, or `failed`.                                           |
| `deadlineAt?`                              | Server epoch milliseconds for the active request's deadline. Legacy jobs may lack it. |
| `error?`                                   | Safe display text for the latest failure; do not parse it as an error code.           |
| `capture?`                                 | Last successful capture, which can exist in **any** status.                           |

New requests have a two-minute total deadline starting at enqueue, including
queue time. A scheduled mutation turns overdue queued/fetching work into failed.
Begin and completion also check the deadline, so delayed scheduling cannot allow
a late result to overwrite a capture. Expiry waits for the backend to run if the
backend itself is unavailable. There is no automatic paid-provider retry.

`queued` and `fetching` are busy states. `failed` without capture is an initial
failure; `failed` with capture is a failed refresh retaining previous content.
Keep displaying the capture while refreshing and after failures. Terminal states
normally omit `deadlineAt`; use status first (old deleted/restored rows can retain
an irrelevant deadline).

Full captures include `id`, `capturedAt`, `url?`, `prompt?`, `title?`, `content`
(Markdown), and `data?` (serialized extraction JSON). Cards replace content/data
with a 500-character `preview`. Display capture provenance from `capture.url` and
`capture.prompt`, not the latest request fields. An absent capture prompt means
no extraction was requested. Existing legacy captures without a URL receive a
one-time fallback from the stored request when refreshed; previously lost legacy
provenance cannot be reconstructed.

## Request and retry

`api.Sources.request` still returns `Id<"sources">`. Existing ordinary refresh
calls remain supported. Optional arguments have been added:

```ts
await request({
  workspaceId,
  sourceId: page.id,
  url: page.url,
  // Omit prompt to retain it; use "" to explicitly remove extraction.
  expectedRevision: page.revision,
});
```

Pass `expectedRevision` in new UI integrations to reject stale edits/retries.
For a ready/failed page, this starts a new revision and retains the capture.
For identical URL/prompt on an active page, it returns that page's ID without
changing the revision/deadline or scheduling more work. This coalescing also
accepts replay of an acknowledged-or-lost active request with an older expected
revision because it does not mutate anything. Once terminal, stale expected
revision requests reject instead of starting another capture.

Changing an active request must be intentional:

```ts
await request({
  workspaceId,
  sourceId: page.id,
  url: nextUrl,
  prompt: nextPrompt, // "" explicitly clears it
  expectedRevision: page.revision,
  replaceActive: true,
});
```

Replacement supersedes old work; it cannot cancel a provider request already in
flight or refund its credits. Late results and expiry from the old revision are
ignored. Matching requests coalesce even across collaborators. Whitespace around
new prompts is trimmed; blank prompts select plain Markdown capture. URLs are
normalized before comparison.

Conflicts throw `ConvexError` with `data: { code, message }`:

| Code                       | Handling                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `SOURCE_REQUEST_ACTIVE`    | A different active request exists; wait or offer explicit replacement with the latest revision. |
| `SOURCE_REVISION_CONFLICT` | Refresh the subscribed state; do not automatically replace the newer request.                   |

Existing access/input/capacity rejection behavior remains unchanged. Rejection
does not enqueue work or alter the previous capture. Provider failures are stored
in `status/error`, rather than thrown back from the enqueue mutation. Messages
distinguish missing configuration, rejected key, credits, forbidden site, rate
limit, timeout, oversized result, and malformed/incomplete output. Retry after
the underlying cause is resolved; no client retry loop is required.

For new canvas elements, continue using the Canvas History create command, which
has operation replay protection. Direct `Sources.request` without `sourceId`
creates a new page each time; it is not an idempotent create API. The 20-Web-Page
limit remains separate from document capacity.

## Recovery

Automatic expiry handles new jobs. For a visibly stranded legacy job (no deadline)
or an overdue job whose expiry has not executed, an explicit recovery action can
call:

```ts
const recovered = await recover({
  workspaceId,
  id: page.id,
  revision: page.revision,
}); // api.Sources.recover
```

`true` means the matching busy revision was marked failed, preserving its capture.
`false` means nothing changed: newer revision, completed/removed/missing page,
foreign page, or an unexpired deadline. Unauthorized workspace access throws.
The mutation is idempotent and never contacts Firecrawl. It is safe to call again
with the same revision. Subscribe to the resulting state, then offer normal
Refresh. An absent legacy deadline permits recovery immediately; that deliberately
invalidates any old result still in flight. Do not label absent deadlines as
confirmed timeouts or automatically recover them just because they are legacy.

## Capture acceptance and verification

Every current request asks for non-whitespace Markdown. Inferred extraction must
match the versioned envelope below; legacy explicit-table extraction must match
its requested columns. Invalid output cannot replace previous content. Deletion
invalidates in-flight work; Undo restores retained content without fetching again.

Regression coverage: `SourceRecovery.test.ts`, `Firecrawl.test.ts`,
`WebPages.test.ts`, and `ExternalEffects.test.ts`. These use mocked provider I/O
and in-memory Convex state. No live-provider or deployed-runtime proof is implied.

## Instruction-only extraction

The UI submits URL plus optional `prompt`. No separate shape or column inputs.
Without instructions, capture remains main-content Markdown. With instructions,
one schema-driven provider call infers text or table output from actual page
content and honors column names/order explicitly mentioned in the instructions.
No client regex chooses the output's meaning or columns.

Format-only instructions such as “Return as CSV table” are accepted in inferred
mode: the provider is asked for relevant page facts/records and useful columns,
never instruction metadata. This is a documented default, not a guarantee that the
provider will select the user's intended facts. Users can refine their instructions.

Successful inferred captures carry `extractionFormat: "inferred-v1"` alongside the
original Markdown `content`, request URL/prompt and timestamp. `data` is serialized:

```ts
{ kind: "text", text: "Extracted answer", columns: [], rows: [] }
{ kind: "table", text: "Optional context", columns: ["Item", "Cost"], rows: [["Example", null]] }
```

Only those four envelope keys are allowed. Text output requires nonblank text and
empty columns/rows. Tables require 1–20 unique trimmed column names, each 1–80
characters, and at most 200 rows of exactly that width. Cells are strings (maximum
10,000 characters) or null. Duplicate names are checked case-insensitively;
reserved object keys are rejected. An empty rows array with valid columns means
no matches. Text is capped at 100,000 characters; existing serialized/combined
capture size limits still apply. Structure is validated locally; factual accuracy
and semantic adherence (including requested names) remain provider responsibilities.

Cards include the format marker and existing Markdown preview, not complete rows.
Render an inferred envelope only when its saved capture has the marker, using
`isInferredSourceData` / `InferredSourceData` from `@pluribus/core/sources/domain`.
Use capture provenance, not pending request settings. Invalid marked data should
remain available as raw data with an error; unmarked legacy JSON remains readable.

### Compatibility and refresh

The legacy `table?: { columns: string[] }` API on requests and History creation
remains supported; its data stays `{ rows: [records with named string|null cells] }`
and capture.table records its columns. Legacy explicit mode retains its input
validation. Existing stored general JSON/plain/explicit-table captures are not
rewritten or retroactively marked inferred.

Omitting table on refresh retains a legacy explicit setting. Deliberate UI edits
send `table: null` to switch to instruction-only inference; no-prompt plain capture
uses `prompt: ""` plus `table: null`. New UI creations omit table. Ordered explicit
columns still participate in active-request identity alongside URL/prompt. Inferred
columns are output, never request identity. Current request, deadline, coalescing,
recovery, provenance and failed-refresh retention rules remain unchanged.

Provider schema syntax follows [Firecrawl JSON extraction](https://docs.firecrawl.dev/developer-guides/common-sites/amazon).
This change is verified with mocked I/O only; no live request or deployment.

## Above-fold screenshot

Every scrape requests Markdown/extraction and one viewport screenshot together:
`{ type: "screenshot", fullPage: false, quality: 80, viewport: { width: 1280, height: 800 } }`.
No second paid scrape or local-browser substitute is used. Firecrawl documents that
[screenshot URLs expire after 24 hours](https://docs.firecrawl.dev/features/scrape),
so the action copies the image into Convex storage; no provider URL is persisted.

Cards/list/get expose capture-owned `screenshot?: { url: string | null, width: number,
height: number }` and `screenshotError?: string`. Storage IDs remain internal;
URLs are resolved on authenticated reads. Null means the stored image is unavailable.
No fields means a legacy capture. The image uses the same capture ID, timestamp,
URL and successful request revision as its text; it is not a live preview.

Only HTTPS Firecrawl subdomains or `storage.googleapis.com` assets are downloaded,
without credentials or redirects. The adapter bounds download to 10 seconds/5 MiB,
requires PNG/JPEG MIME/signature and validates exact 1280×800 dimensions. Unknown
asset hosts, missing images, download/storage failures and unexpected dimensions
produce a safe screenshot warning. Usable text still becomes ready. A successful
new text capture with no image never reuses an older image; a failed overall refresh
retains the entire previous capture/image. If the combined provider call itself
fails, no automatic second scrape is attempted.

A pending-asset ledger schedules cleanup after five minutes; stale/deleted/expired
completion discards only pending files. Accepted files are retained even after
replacement or soft deletion because immutable agent-context snapshots can reference
them. Cleanup never deletes an accepted file on replay. No retention/GC policy for
accepted captures is introduced here. A process crash between blob storage and
ledger registration can leave an unregistered orphan; registered pending files are
covered by cleanup. Provider URL-host compatibility and image decode/render quality
remain unverified live; tests use mocked raster headers and storage.
