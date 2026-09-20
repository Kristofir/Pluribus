import { v, type Infer } from "convex/values";
import { createRecordedElement } from "@pluribus/core/canvas/creations";
import type { MutationCtx } from "../_generated/server";
import { color, geometry } from "./Model";
import { historyCredentials } from "./HistoryCredentials";
import { elementLifecycles, toElementId } from "./ElementLifecycles";
import { create, createDocument } from "./Handlers";

export const creation = v.union(
  v.object({ kind: v.literal("rectangle"), geometry, color }),
  v.object({ kind: v.literal("document"), geometry }),
);

/** Bind an idempotent creation request to its canonical Element in the same transaction. */
export async function createElement(
  ctx: MutationCtx,
  args: {
    operation: string;
    secret: string;
    element: Infer<typeof creation>;
  },
) {
  const { actor, credential } = await historyCredentials(
    ctx,
    args.operation,
    args.secret,
  );
  const input = args.element;
  const { x, y, width, height } = input.geometry;
  const request = JSON.stringify([
    input.kind,
    x,
    y,
    width,
    height,
    input.kind === "rectangle" ? input.color : null,
  ]);
  const normalize = (id: string) => {
    const stored =
      ctx.db.normalizeId("rectangles", id) ??
      ctx.db.normalizeId("canvasDocuments", id);
    if (!stored) throw new Error("Invalid Element");
    return stored;
  };
  const result = await createRecordedElement(
    {
      kind: input.kind,
      elements: elementLifecycles(ctx),
      async find(operation) {
        const row = await ctx.db
          .query("canvasCreations")
          .withIndex("by_operation", (q) => q.eq("operation", operation))
          .unique();
        return row ? { ...row, element: toElementId(row.element) } : null;
      },
      async record(receipt) {
        await ctx.db.insert("canvasCreations", {
          ...receipt,
          element: normalize(receipt.element),
        });
      },
      async create() {
        return toElementId(
          input.kind === "rectangle"
            ? await create(ctx, input)
            : await createDocument(ctx, input),
        );
      },
    },
    actor,
    { ...credential, request },
  );
  return { ...result, id: result.id ? normalize(result.id) : null };
}
