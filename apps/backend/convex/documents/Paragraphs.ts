import { paragraphRows } from "@pluribus/editor/paragraphs";
import { components } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireDocument } from "./Access";
import { materialize } from "./Sync";
import { requireWorkspace } from "../workspaces/Access";

/** Public descriptor keeps panel identity independent of geometry and rendering. */
export async function describeDocument(ctx: QueryCtx, documentId: Id<"documents">) {
 const doc = await requireDocument(ctx, documentId);
 const child = doc.element ? await ctx.db.get(doc.element) : null;
 if (!child || child.removed) throw new Error("Document unavailable");
 return { documentId, canvasId: child.canvas, generation: child.generation, role: child.role ?? "card", paragraphs: !!doc.paragraphs };
}
export async function readParagraphs(ctx: QueryCtx, documentId: Id<"documents">) {
 const descriptor = await describeDocument(ctx, documentId);
 const version = await ctx.runQuery(components.prosemirrorSync.lib.latestVersion, { id: documentId });
 if (version === null) throw new Error("Document unavailable");
 const doc = (await materialize(ctx, documentId, version)).doc;
 return { ...descriptor, version, paragraphs: paragraphRows(doc).map(p => ({ paragraphId: p.id ?? "", text: p.text, from: p.from + 1, to: p.to - 1 })) };
}
export async function linkParagraph(ctx: MutationCtx, args: { workspaceId: Id<"workspaces">; elementId: Id<"rectangles"> | Id<"canvasDocuments">; documentId: Id<"documents">; paragraphId: string; version: number }) {
 await requireWorkspace(ctx, args.workspaceId);
 const element = await ctx.db.get(args.elementId);
 if (!element || !("x" in element) || element.removed || ("canvas" in element ? element.canvas !== args.workspaceId : element.workspaceId !== args.workspaceId)) throw new Error("Element unavailable");
 const current = await readParagraphs(ctx, args.documentId);
 if (current.canvasId !== args.workspaceId) throw new Error("Document belongs to another workspace");
 if (current.version !== args.version) throw new Error("Document changed; select the paragraph again");
 if (!current.paragraphs.some(p => p.paragraphId === args.paragraphId)) throw new Error("Paragraph unavailable");
 const existing = await ctx.db.query("documentLinks").withIndex("by_element", q => q.eq("elementId", args.elementId)).unique();
 const value = { workspaceId: args.workspaceId, elementId: args.elementId, documentId: args.documentId, paragraphId: args.paragraphId };
 if (existing) await ctx.db.replace(existing._id, value); else await ctx.db.insert("documentLinks", value);
 return null;
}
