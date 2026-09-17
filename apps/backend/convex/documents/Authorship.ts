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
import { assertRestoration } from "@pluribus/core/documents/authorship";
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
) {
  let doc = before;
  const local: AuthoredStep[] = [];
  const restoredMoves = new Map<string, Set<string>>();
  const moveSlices = new Map<string, { slice: Slice; operation: string }>();
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    if (!(step instanceof AuthoredStep))
      throw new Error("Reload this document to use authorship");
    const version = baseVersion + index;
    if (
      await ctx.db
        .query("documentOperations")
        .withIndex("by_document_operation", (q) =>
          q.eq("document", document).eq("operation", step.id),
        )
        .unique()
    )
      throw new Error("Operation already accepted");
    let moveGroup = step.move?.group,
      movePart = step.move?.part;
    if (step.undoOf) {
      const receipt = await ctx.db
        .query("documentOperations")
        .withIndex("by_document_operation", (q) =>
          q.eq("document", document).eq("operation", step.undoOf!),
        )
        .unique();
      if (!receipt) throw new Error("Restoration evidence unavailable");
      assertRestoration(
        actor.author,
        actor.session,
        {
          actor: receipt.author,
          session: receipt.session,
          scope: receipt.scope,
          consumed: !!receipt.revertedBy,
        },
        scope,
      );
      if (receipt.moveGroup && receipt.movePart) {
        const parts = restoredMoves.get(receipt.moveGroup) ?? new Set<string>();
        if (parts.has(receipt.movePart))
          throw new Error("Repeated move restoration");
        parts.add(receipt.movePart);
        restoredMoves.set(receipt.moveGroup, parts);
        moveGroup = receipt.moveGroup;
        movePart = receipt.movePart;
      }
      let cursor = receipt.version;
      const intervening: Step[] = [];
      while (cursor < baseVersion) {
        const batch = await ctx.runQuery(
          components.prosemirrorSync.lib.getSteps,
          { id: document, version: cursor },
        );
        const values = batch.steps.slice(0, baseVersion - cursor);
        if (!values.length) throw new Error("Restoration history unavailable");
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
        JSON.parse(receipt.inverse),
      ).map(mapping);
      const expected = inverse?.apply(doc),
        actual = step.apply(doc);
      if (!expected?.doc || !actual.doc || !expected.doc.eq(actual.doc))
        throw new Error("Restoration does not match accepted operation");
      await ctx.db.patch(receipt._id, { revertedBy: step.id });
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
        if (!source || inner.from !== inner.to || !source.slice.eq(inner.slice))
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
    await ctx.db.insert("documentOperations", {
      document,
      scope,
      operation: step.id,
      author: actor.author,
      session: actor.session,
      version: version + 1,
      inverse: JSON.stringify(inverse.toJSON()),
      ...(moveGroup && movePart ? { moveGroup, movePart } : {}),
      ...(step.undoOf ? { undoOf: step.undoOf } : {}),
    });
    local.push(step);
  }
  if ([...restoredMoves.values()].some((parts) => parts.size !== 2))
    throw new Error("Restore the complete move operation");
  if (moveSlices.size) throw new Error("Incomplete move operation");
  return doc;
}
