import { getAuthUserId } from "@convex-dev/auth/server";
import type { DeletionReceipts } from "@pluribus/core/canvas/deletions";
import {
  deleteCanvasDocument,
  undoDocumentDeletion,
} from "@pluribus/core/canvas/deletions";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { canvasDocuments, toDocumentElementId } from "./Documents";

/** Hash operation capabilities at the adapter boundary; raw secrets never enter storage. */
async function proof(secret: string) {
  if (!/^[0-9a-f-]{36}$/.test(secret))
    throw new Error("Invalid deletion credential");
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
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
            element: toDocumentElementId(row.element),
            generation: row.generation,
            owner: row.owner,
            proof: row.proof,
            restoredGeneration: row.restoredGeneration,
          }
        : null;
    },
    async record(receipt) {
      const element = ctx.db.normalizeId("canvasDocuments", receipt.element);
      if (!element) throw new Error("Invalid child");
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
  if (!/^[0-9a-f-]{36}$/.test(operation))
    throw new Error("Invalid deletion operation");
  const user = await getAuthUserId(ctx);
  return {
    dependencies: {
      cards: canvasDocuments(ctx),
      receipts: deletionReceipts(ctx),
    },
    actor: {
      access: user
        ? { kind: "authenticated" as const }
        : { kind: "anonymous" as const },
      owner: user,
    },
    credential: { operation, proof: await proof(secret) },
  };
}
export async function deleteDocument(
  ctx: MutationCtx,
  args: {
    id: Id<"canvasDocuments">;
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
  return deleteCanvasDocument(dependencies, actor, {
    ...credential,
    element: toDocumentElementId(args.id),
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
  return undoDocumentDeletion(dependencies, actor, credential);
}
