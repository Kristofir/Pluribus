import { canvasScope } from "../workspaces/Access";
import {
  createCanvasDocument,
  changeCanvasDocument,
  type DocumentChange,
} from "@pluribus/core/canvas/documents";
import { canvasDocuments, spatialDocuments, toDocumentElementId } from "./Documents";
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

export async function list(ctx: QueryCtx, args: { workspaceId?: Id<"workspaces"> } = {}) {
  await canvasScope(ctx, args.workspaceId);
  assertCanvasAccess(await canvasActor(ctx));
  const records = await ctx.db
    .query("rectangles")
    .withIndex("by_workspace_removed", (q) => q.eq("workspaceId", args.workspaceId).eq("removed", undefined))
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
    workspaceId?: Id<"workspaces">;
    geometry: Infer<typeof geometryValidator>;
    color: Infer<typeof color>;
  },
) {
  await canvasScope(ctx, input.workspaceId);
  const id = await createRectangle(
    { rectangles: rectanglePersistence(ctx, input.workspaceId) },
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
    workspaceId,
  }: {
    workspaceId?: Id<"workspaces">;
    id: Id<"rectangles">;
    geometry: Infer<typeof geometryValidator>;
    generation: number;
  },
) {
  await canvasScope(ctx, workspaceId);
  return updateRectangleGeometry(
    { rectangles: rectanglePersistence(ctx, workspaceId) },
    await canvasActor(ctx),
    toRectangleId(id),
    geometry,
    generation,
  );
}
export async function createDocument(
  ctx: MutationCtx,
  args: { geometry: Infer<typeof geometryValidator>; workspaceId?: Id<"workspaces"> },
) {
  await canvasScope(ctx, args.workspaceId);
  const id = await createCanvasDocument(
    { cards: canvasDocuments(ctx, args.workspaceId), text: childText(ctx, args.workspaceId) },
    await canvasActor(ctx),
    args.geometry,
  );
  const stored = ctx.db.normalizeId("canvasDocuments", id);
  if (!stored) throw new Error("Invalid child");
  return stored;
}
export async function documentCards(ctx: QueryCtx, args: { workspaceId?: Id<"workspaces"> } = {}) {
  await canvasScope(ctx, args.workspaceId);
  assertCanvasAccess(await canvasActor(ctx));
  const rows = await spatialDocuments(ctx, args.workspaceId ?? "shared", 2);
  return rows.map((r) => {
    if (!("x" in r) || !r.documentId) throw new Error("Incomplete document child");
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
    workspaceId?: Id<"workspaces">;
    id: Id<"canvasDocuments">;
    generation: number;
    change: DocumentChange;
  },
) {
  await canvasScope(ctx, args.workspaceId);
  return changeCanvasDocument(
    { cards: canvasDocuments(ctx, args.workspaceId) },
    await canvasActor(ctx),
    toDocumentElementId(args.id),
    args.generation,
    args.change,
  );
}
