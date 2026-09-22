import { assertParagraphIds } from "@pluribus/editor/paragraphs";
import { Step, Transform } from "@tiptap/pm/transform";
import { documentSchema as schema } from "@pluribus/editor/schema";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireDocument } from "./Access";
import { requireAuthor, type Credential } from "./Authors";
import { acceptAuthorship } from "./Authorship";

const sync = components.prosemirrorSync.lib;
export function assertVersion(version: number) {
  if (!Number.isSafeInteger(version) || version < 1)
    throw new Error("Invalid document version");
}

/**
 * Reconstruct an authorized document at an accepted version using a snapshot
 * and bounded step batches. Returns an in-memory Transform for validation;
 * long unsnapshotted histories can hit transaction limits.
 */
export async function materialize(ctx: QueryCtx, id: string, target: number) {
  const snapshot = await ctx.runQuery(sync.getSnapshot, {
    id,
    version: target,
  });
  if (snapshot.content === null) throw new Error("Document content not found");
  const transform = new Transform(
    schema.nodeFromJSON(JSON.parse(snapshot.content)),
  );
  let version = snapshot.version;
  // Native reads are bounded; loop to handle documents with more than 100 deltas.
  while (version < target) {
    const batch = await ctx.runQuery(sync.getSteps, { id, version });
    const steps = batch.steps.slice(0, target - version);
    if (!steps.length) throw new Error("Missing document steps");
    for (const step of steps)
      transform.step(Step.fromJSON(schema, JSON.parse(step)));
    version += steps.length;
  }
  return transform;
}

/**
 * Authorize incremental edits and validate current-version steps against the
 * schema and size limit before writing. Stale submissions return needs-rebase
 * for the client to retry; future versions throw. Checks and writes are atomic.
 */
export async function submitDocumentSteps(
  ctx: MutationCtx,
  args: {
    id: string;
    version: number;
    clientId: string | number;
    steps: string[];
    credential?: Credential;
    protocol?: number;
  },
  delegation?: {
    userId: Id<"users">;
    author: Id<"documentAuthors">;
    session: Id<"documentAuthorSessions">;
    restoration?: { author: string; session: string; operations: string[] };
  },
) {
  const document = await requireDocument(
    ctx,
    args.id,
    true,
    delegation?.userId,
  );
  const scope = args.id;
  const actor = document.authorship
    ? delegation
      ? { author: delegation.author, session: delegation.session }
      : await requireAuthor(ctx, scope, args.credential)
    : null;
  if (document.authorship && args.protocol !== 1)
    throw new Error("Reload this document to use authorship");
  assertVersion(args.version);
  if (!args.steps.length || args.steps.length > 1000)
    throw new Error("Invalid step count");
  const latest = await ctx.runQuery(sync.latestVersion, { id: document._id });
  if (latest === null || args.version > latest)
    throw new Error("Invalid document version");
  let acceptedContent: string | undefined;
  if (args.version === latest) {
    const transform = await materialize(ctx, document._id, latest);
    const steps = args.steps.map((step) =>
      Step.fromJSON(schema, JSON.parse(step)),
    );
    if (actor)
      await acceptAuthorship(
        ctx,
        document._id,
        scope,
        actor,
        latest,
        transform.doc,
        steps,
        delegation?.restoration,
      );
    for (const step of steps) transform.step(step);
    transform.doc.check();
    if (document.paragraphs) assertParagraphIds(transform.doc);
    if (!actor)
      transform.doc.descendants((node) => {
        if (node.marks.some((mark) => mark.type.name === "authorship"))
          throw new Error("Enable authorship before attributing text");
      });
    if (JSON.stringify(transform.doc.toJSON()).length > 100_000)
      throw new Error("Document exceeds prototype size limit");
    acceptedContent = JSON.stringify(transform.doc.toJSON());
  }
  // Stale versions retain the native needs-rebase response; the client rebases.
  const result = await ctx.runMutation(sync.submitSteps, {
    id: document._id,
    version: args.version,
    clientId: args.clientId,
    steps: args.steps,
  });
  if (acceptedContent && result.status === "synced") {
    const checkpoint = await ctx.runQuery(sync.getSnapshot, {
      id: document._id,
    });
    if (
      checkpoint.content !== null &&
      latest + args.steps.length - checkpoint.version >= 100
    )
      await ctx.runMutation(sync.submitSnapshot, {
        id: document._id,
        version: latest + args.steps.length,
        content: acceptedContent,
        pruneSnapshots: true,
      });
  }
  return result;
}

/**
 * Store a snapshot only when it matches accepted content at that version.
 * Validation and storage are atomic; older snapshots may be pruned.
 * This speeds loading without replacing accepted edits.
 */
export async function submitDocumentSnapshot(
  ctx: MutationCtx,
  args: { id: string; version: number; content: string },
) {
  const document = await requireDocument(ctx, args.id, true);
  args = { ...args, id: document._id };
  assertVersion(args.version);
  const latest = await ctx.runQuery(sync.latestVersion, { id: args.id });
  if (latest === null || args.version > latest)
    throw new Error("Invalid document version");
  const canonical = (await materialize(ctx, args.id, args.version)).doc;
  const proposed = schema.nodeFromJSON(JSON.parse(args.content));
  proposed.check();
  if (!canonical.eq(proposed))
    throw new Error("Snapshot does not match accepted edits");
  await ctx.runMutation(sync.submitSnapshot, {
    ...args,
    content: JSON.stringify(canonical.toJSON()),
    pruneSnapshots: true,
  });
  return null;
}
