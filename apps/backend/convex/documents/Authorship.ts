import {
  AddMarkStep,
  RemoveMarkStep,
  ReplaceStep,
  ReplaceAroundStep,
  Step,
  Mapping,
} from "@tiptap/pm/transform";
import type { Node, Slice } from "@tiptap/pm/model";
import { AuthoredStep } from "@pluribus/editor/protocol";
import { documentSchema } from "@pluribus/editor/schema";
import {
  acceptAuthoredOperations,
  type AuthorshipEvidence,
} from "@pluribus/core/documents/acceptance";
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

function checkInserted(slice: Slice, author: string) {
  slice.content.descendants((node) => {
    if (
      node.isText &&
      node.marks.find((mark) => mark.type.name === "authorship")?.attrs
        .author !== author
    )
      throw new Error("Inserted text must belong to its writer");
  });
}
function ordinary(step: Step, author: string) {
  if (step instanceof ReplaceStep || step instanceof ReplaceAroundStep)
    checkInserted(step.slice, author);
  else if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
    if (step.mark.type.name === "authorship")
      throw new Error("Cannot rewrite authorship");
  } else throw new Error("Unsupported authored edit");
}
/** Verify restoration against the accepted inverse, mapped through canonical intervening edits. */
export async function acceptAuthorship(
  ctx: MutationCtx,
  document: Id<"documents">,
  scope: string,
  actor: {
    author: Id<"documentAuthors">;
    session: Id<"documentAuthorSessions">;
  },
  baseVersion: number,
  before: Node,
  steps: Step[],
  delegation?: { author: string; session: string; operations: string[] },
) {
  let doc = before;
  const local: AuthoredStep[] = [];
  const moveSlices = new Map<string, { slice: Slice; operation: string }>();
  const authored = steps.map((step) => {
    if (!(step instanceof AuthoredStep))
      throw new Error("Reload this document to use authorship");
    return step;
  });
  await acceptAuthoredOperations(
    {
      evidence: operationEvidence(ctx, document, actor),
      edits: {
        async apply(index, receipt) {
          const step = authored[index];
          let moveGroup = step.move?.group,
            movePart = step.move?.part;
          if (receipt) {
            const inverse = await mappedInverse(ctx, document, receipt, baseVersion, local);
            const expected = inverse?.apply(doc),
              actual = step.apply(doc);
            if (!expected?.doc || !actual.doc || !expected.doc.eq(actual.doc))
              throw new Error("Restoration does not match accepted operation");
          } else if (step.move) {
            const inner = step.inner;
            if (!(inner instanceof ReplaceStep))
              throw new Error("Move must use replacement steps");
            if (step.move.part === "remove") {
              if (
                inner.from !== step.move.from ||
                inner.to !== step.move.to ||
                inner.slice.size ||
                moveSlices.has(step.move.group)
              )
                throw new Error("Invalid move source");
              moveGroup = step.id;
              moveSlices.set(step.move.group, {
                slice: doc.slice(inner.from, inner.to),
                operation: step.id,
              });
            } else {
              const source = moveSlices.get(step.move.group);
              if (
                !source ||
                inner.from !== inner.to ||
                !source.slice.eq(inner.slice)
              )
                throw new Error("Move does not preserve source attribution");
              moveGroup = source.operation;
              moveSlices.delete(step.move.group);
            }
          } else ordinary(step.inner, actor.author);
          const inverse = step.inner.invert(doc);
          const result = step.apply(doc);
          if (!result.doc)
            throw new Error(result.failed ?? "Invalid authored operation");
          doc = result.doc;
          local.push(step);
          return {
            proof: JSON.stringify(inverse.toJSON()),
            ...(moveGroup && movePart
              ? { move: { group: moveGroup, part: movePart } }
              : {}),
          };
        },
        assertComplete() {
          if (moveSlices.size) throw new Error("Incomplete move operation");
        },
      },
    },
    actor,
    scope,
    baseVersion,
    authored.map(({ id, undoOf }) => ({ id, undoOf })),
    delegation,
  );
  return doc;
}

/** Receipts are document-scoped and share the sync caller's transaction. */
function operationEvidence(
  ctx: MutationCtx,
  document: Id<"documents">,
  actor: {
    author: Id<"documentAuthors">;
    session: Id<"documentAuthorSessions">;
  },
): AuthorshipEvidence<string> {
  const receiptIds = new Map<string, Id<"documentOperations">>();
  const find = (operation: string) =>
    ctx.db
      .query("documentOperations")
      .withIndex("by_document_operation", (q) =>
        q.eq("document", document).eq("operation", operation),
      )
      .unique();
  return {
    async find(operation) {
      const row = await find(operation);
      if (row) receiptIds.set(operation, row._id);
      return row
        ? {
            author: row.author,
            session: row.session,
            scope: row.scope,
            consumed: !!row.revertedBy,
            version: row.version,
            proof: row.inverse,
            ...(row.moveGroup && row.movePart
              ? { move: { group: row.moveGroup, part: row.movePart } }
              : {}),
          }
        : null;
    },
    async consume(operation, revertedBy) {
      const id = receiptIds.get(operation);
      if (!id) throw new Error("Restoration evidence unavailable");
      await ctx.db.patch(id, { revertedBy });
    },
    async record(operation, receipt) {
      await ctx.db.insert("documentOperations", {
        document,
        ...actor,
        scope: receipt.scope,
        operation: operation.id,
        version: receipt.version,
        inverse: receipt.proof,
        ...(receipt.move
          ? { moveGroup: receipt.move.group, movePart: receipt.move.part }
          : {}),
        ...(operation.undoOf ? { undoOf: operation.undoOf } : {}),
      });
    },
  };
}

/** Shared editor-mechanics adapter for personal and explicitly delegated inverse proof. */
export async function mappedInverse(ctx: MutationCtx, document: Id<"documents">, receipt: { version: number; proof: string }, baseVersion: number, local: AuthoredStep[]) {
  let cursor = receipt.version;
  const intervening: Step[] = [];
  while (cursor < baseVersion) {
    const batch = await ctx.runQuery(
      components.prosemirrorSync.lib.getSteps,
      { id: document, version: cursor },
    );
    const values = batch.steps.slice(0, baseVersion - cursor);
    if (!values.length)
      throw new Error("Restoration history unavailable");
    intervening.push(
      ...values.map((value) =>
        Step.fromJSON(documentSchema, JSON.parse(value)),
      ),
    );
    cursor += values.length;
  }
  intervening.push(...local);
  const mapping = new Mapping(),
    positions = new Map<string, number>();
  for (const other of intervening) {
    const mirror =
      other instanceof AuthoredStep && other.undoOf
        ? positions.get(other.undoOf)
        : undefined;
    const pos = mapping.maps.length;
    mapping.appendMap(other.getMap(), mirror);
    if (other instanceof AuthoredStep) positions.set(other.id, pos);
  }
  const inverse = Step.fromJSON(
    documentSchema,
    JSON.parse(receipt.proof),
  ).map(mapping);

  return inverse;
}
