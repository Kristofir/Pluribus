import type { ChildText } from "@pluribus/core/canvas/documents";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { components } from "../_generated/api";
import { toDocumentId } from "./Access";
/** Documents' transaction-bound creation interface, supplied by the composition endpoint. */
export function childText(ctx: MutationCtx, workspaceId?: Id<"workspaces">): ChildText {
  return {
    async create(owner) {
      const element = ctx.db.normalizeId("canvasDocuments", owner);
      if (!element) throw new Error("Invalid canvas child");
      const id = await ctx.db.insert("documents", {
        key: `canvas:${element}`,
        access: workspaceId ? "workspace" : "public",
        workspaceId,
        ...(workspaceId ? { paragraphs: 1 as const } : {}),
        element,
      });
      await ctx.runMutation(components.prosemirrorSync.lib.submitSnapshot, {
        id,
        version: 1,
        content: JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", ...(workspaceId ? { attrs: { paragraphId: crypto.randomUUID() } } : {}) }],
        }),
      });
      return toDocumentId(id);
    },
  };
}
