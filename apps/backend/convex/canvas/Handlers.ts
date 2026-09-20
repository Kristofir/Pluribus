import {
  createCanvasDocument,
  changeCanvasDocument,
  type DocumentChange,
} from "@pluribus/core/canvas/documents";
import { canvasDocuments, toDocumentElementId } from "./Documents";
import { childText } from "../documents/ChildText";
import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import {
  createRectangle,
  updateRectangleGeometry,
} from "@pluribus/core/canvas/application";
import { assertCanvasAccess } from "@pluribus/core/canvas/access";
import { rectangleLimits } from "@pluribus/core/canvas/domain";
import type { color, geometry as geometryValidator } from "./Model";
import { canvasActor } from "./Actor";
import { rectanglePersistence, toRectangleId } from "./Persistence";

export async function list(ctx: QueryCtx) {
  assertCanvasAccess(await canvasActor(ctx));
  const records = await ctx.db
    .query("rectangles")
    .withIndex("by_removed", (q) => q.eq("removed", undefined))
    .take(rectangleLimits.maxCount);
  return records.map(({ _id, x, y, width, height, color, generation }) => ({
    id: _id,
    x,
    y,
    width,
    height,
    color,
    generation: generation ?? 1,
  }));
}

export async function create(
  ctx: MutationCtx,
  input: {
    geometry: Infer<typeof geometryValidator>;
    color: Infer<typeof color>;
  },
) {
  const id = await createRectangle(
    { rectangles: rectanglePersistence(ctx) },
    await canvasActor(ctx),
    input,
  );
  const storedId = ctx.db.normalizeId("rectangles", id);
  if (!storedId) throw new Error("Invalid persisted rectangle ID.");
  return storedId;
}
export async function updateGeometry(
  ctx: MutationCtx,
  {
    id,
    geometry,
    generation,
  }: {
    id: Id<"rectangles">;
    geometry: Infer<typeof geometryValidator>;
    generation: number;
  },
) {
  return updateRectangleGeometry(
    { rectangles: rectanglePersistence(ctx) },
    await canvasActor(ctx),
    toRectangleId(id),
    geometry,
    generation,
  );
}
export async function createDocument(
  ctx: MutationCtx,
  args: { geometry: Infer<typeof geometryValidator> },
) {
  const id = await createCanvasDocument(
    { cards: canvasDocuments(ctx), text: childText(ctx) },
    await canvasActor(ctx),
    args.geometry,
  );
  const stored = ctx.db.normalizeId("canvasDocuments", id);
  if (!stored) throw new Error("Invalid child");
  return stored;
}
export async function documentCards(ctx: QueryCtx) {
  assertCanvasAccess(await canvasActor(ctx));
  const rows = await ctx.db
    .query("canvasDocuments")
    .withIndex("by_canvas_removed", (q) =>
      q.eq("canvas", "shared").eq("removed", false),
    )
    .take(2);
  return rows.map((r) => {
    if (!r.documentId) throw new Error("Incomplete document child");
    return {
      id: r._id,
      documentId: r.documentId,
      geometry: { x: r.x, y: r.y, width: r.width, height: r.height },
      generation: r.generation,
      removed: r.removed,
    };
  });
}
export async function changeDocument(
  ctx: MutationCtx,
  args: {
    id: Id<"canvasDocuments">;
    generation: number;
    change: DocumentChange;
  },
) {
  return changeCanvasDocument(
    { cards: canvasDocuments(ctx) },
    await canvasActor(ctx),
    toDocumentElementId(args.id),
    args.generation,
    args.change,
  );
}
