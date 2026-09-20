import { historyCredentials } from "./HistoryCredentials";
import type { DeletionReceipts } from "@pluribus/core/canvas/deletions";
import {
  deleteCanvasElement,
  undoElementDeletion,
} from "@pluribus/core/canvas/deletions";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { elementLifecycles, toElementId } from "./ElementLifecycles";

function deletionReceipts(ctx: MutationCtx): DeletionReceipts {
  const find = (operation: string) =>
    ctx.db
      .query("canvasDeletions")
      .withIndex("by_operation", (q) => q.eq("operation", operation))
      .unique();
  return {
    async find(operation) {
      const row = await find(operation);
      return row
        ? {
            operation: row.operation,
            element: toElementId(row.element),
            generation: row.generation,
            owner: row.owner,
            proof: row.proof,
            restoredGeneration: row.restoredGeneration,
          }
        : null;
    },
    async record(receipt) {
      const element =
        ctx.db.normalizeId("canvasDocuments", receipt.element) ??
        ctx.db.normalizeId("rectangles", receipt.element);
      if (!element) throw new Error("Invalid Element");
      await ctx.db.insert("canvasDeletions", { ...receipt, element });
    },
    async restore(operation, restoredGeneration) {
      const row = await find(operation);
      if (!row) throw new Error("Deletion receipt missing");
      await ctx.db.patch(row._id, { restoredGeneration });
    },
  };
}
async function context(ctx: MutationCtx, operation: string, secret: string) {
  const { actor, credential } = await historyCredentials(
    ctx,
    operation,
    secret,
  );
  return {
    dependencies: {
      elements: elementLifecycles(ctx),
      receipts: deletionReceipts(ctx),
    },
    actor,
    credential,
  };
}
export async function deleteElement(
  ctx: MutationCtx,
  args: {
    id: Id<"canvasDocuments"> | Id<"rectangles">;
    generation: number;
    operation: string;
    secret: string;
  },
) {
  if (!Number.isSafeInteger(args.generation) || args.generation < 1)
    throw new Error("Invalid generation");
  const { dependencies, actor, credential } = await context(
    ctx,
    args.operation,
    args.secret,
  );
  return deleteCanvasElement(dependencies, actor, {
    ...credential,
    element: toElementId(args.id),
    generation: args.generation,
  });
}
export async function undoDeletion(
  ctx: MutationCtx,
  args: { operation: string; secret: string },
) {
  const { dependencies, actor, credential } = await context(
    ctx,
    args.operation,
    args.secret,
  );
  return undoElementDeletion(dependencies, actor, credential);
}

/** Compatibility endpoint for existing document clients; uses the shared Element policy. */
export const deleteDocument = deleteElement;
