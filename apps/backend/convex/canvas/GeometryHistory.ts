import {
  applyGeometryGesture,
  reverseGeometryGesture,
  type GeometryHistoryPorts,
} from "@pluribus/core/canvas/geometryHistory";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Geometry, ElementId } from "@pluribus/core/canvas/domain";
import { toElementId } from "./ElementLifecycles";
import { historyCredentials } from "./HistoryCredentials";

type StoredId = Id<"rectangles"> | Id<"canvasDocuments">;
function ports(ctx: MutationCtx): GeometryHistoryPorts {
  const storedId = (id: ElementId) => {
    const value =
      ctx.db.normalizeId("rectangles", id) ??
      ctx.db.normalizeId("canvasDocuments", id);
    if (!value) throw new Error("Invalid Element ID");
    return value;
  };
  const find = (operation: string) =>
    ctx.db
      .query("canvasGeometryOperations")
      .withIndex("by_operation", (q) => q.eq("operation", operation))
      .unique();
  return {
    elements: {
      async get(id) {
        if (ctx.db.normalizeId("rectangles", id)) return null;
        const record = await ctx.db.get(storedId(id));
        return record &&
          "x" in record &&
          ("canvas" in record
            ? record.canvas === "shared"
            : !record.workspaceId)
          ? {
              kind: ctx.db.normalizeId("rectangles", id)
                ? "rectangle"
                : "document",
              generation: record.generation ?? 1,
              removed: record.removed ?? false,
              geometry: {
                x: record.x,
                y: record.y,
                width: record.width,
                height: record.height,
              },
            }
          : null;
      },
      write: (id, geometry) => ctx.db.patch(storedId(id), geometry),
    },
    receipts: {
      async find(operation) {
        const row = await find(operation);
        if (!row) return null;
        const { _id, _creationTime, ...receipt } = row;
        return {
          ...receipt,
          changes: receipt.changes.map((c) => ({
            ...c,
            id: toElementId(c.id),
          })),
        };
      },
      async save(receipt) {
        const row = await find(receipt.operation);
        const value = {
          ...receipt,
          changes: receipt.changes.map((c) => ({ ...c, id: storedId(c.id) })),
        };
        if (row) await ctx.db.replace(row._id, value);
        else await ctx.db.insert("canvasGeometryOperations", value);
      },
    },
  };
}

export async function applyGeometry(
  ctx: MutationCtx,
  args: {
    operation: string;
    secret: string;
    sequence: number;
    final: boolean;
    updates: { id: StoredId; generation: number; geometry: Geometry }[];
  },
) {
  const { actor, credential } = await historyCredentials(
    ctx,
    args.operation,
    args.secret,
  );
  return applyGeometryGesture(ports(ctx), actor, {
    ...credential,
    sequence: args.sequence,
    final: args.final,
    updates: args.updates.map((u) => ({ ...u, id: toElementId(u.id) })),
  });
}
export async function reverseGeometry(
  ctx: MutationCtx,
  args: {
    operation: string;
    secret: string;
    revision: number;
    undo: boolean;
  },
) {
  const { actor, credential } = await historyCredentials(
    ctx,
    args.operation,
    args.secret,
  );
  return reverseGeometryGesture(ports(ctx), actor, {
    ...credential,
    revision: args.revision,
    undo: args.undo,
  });
}
