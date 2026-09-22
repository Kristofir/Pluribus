import type { SharedDocumentPersistence } from "@pluribus/core/documents/application";
import type { MutationCtx } from "../_generated/server";
import { components } from "../_generated/api";
import { toDocumentId } from "./Access";

/**
 * Build the core initialization port for this mutation. Metadata and editor
 * content share one ID and commit together; core owns orchestration.
 */
export function documentPersistence(
  ctx: MutationCtx,
): SharedDocumentPersistence {
  return {
    /**
     * Find shared metadata by its indexed key, or return null. The transactional
     * lookup makes concurrent initialization retry rather than create duplicates.
     */
    async findShared() {
      const doc = await ctx.db
        .query("documents")
        .withIndex("by_key", (q) => q.eq("key", "shared"))
        .unique();
      if (doc && (doc.access !== "public" || doc.workspaceId))
        throw new Error("Invalid legacy document ownership");
      return doc ? { id: toDocumentId(doc._id), access: "public" } : null;
    },
    /**
     * Create public metadata and an empty version-1 document atomically. Requires
     * a shared-key lookup in the same transaction; failures roll back both writes.
     */
    async createShared() {
      const id = await ctx.db.insert("documents", {
        key: "shared",
        access: "public",
      });
      await ctx.runMutation(components.prosemirrorSync.lib.submitSnapshot, {
        id,
        version: 1,
        content: JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph" }],
        }),
      });
      return { id: toDocumentId(id), access: "public" };
    },
  };
}
