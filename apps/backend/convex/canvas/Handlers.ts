import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import {
  createRectangle,
  updateRectangleGeometry,
  removeRectangle,
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
    .withIndex("by_creation_time")
    .take(rectangleLimits.maxCount);
  return records.map(({ _id, x, y, width, height, color }) => ({
    id: _id,
    x,
    y,
    width,
    height,
    color,
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
  }: { id: Id<"rectangles">; geometry: Infer<typeof geometryValidator> },
) {
  return updateRectangleGeometry(
    { rectangles: rectanglePersistence(ctx) },
    await canvasActor(ctx),
    toRectangleId(id),
    geometry,
  );
}
export async function remove(
  ctx: MutationCtx,
  { id }: { id: Id<"rectangles"> },
) {
  await removeRectangle(
    { rectangles: rectanglePersistence(ctx) },
    await canvasActor(ctx),
    toRectangleId(id),
  );
  return null;
}
