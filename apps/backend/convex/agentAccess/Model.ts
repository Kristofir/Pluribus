import { v } from "convex/values";
export const edit = v.union(v.object({ kind: v.literal("replace"), paragraphId: v.string(), text: v.string() }), v.object({ kind: v.literal("delete"), paragraphId: v.string() }), v.object({ kind: v.literal("insert"), afterParagraphId: v.union(v.string(), v.null()), text: v.string() }));
export const applyArgs = { token: v.string(), requestId: v.string(), documentId: v.id("documents"), generation: v.number(), baseVersion: v.number(), edits: v.array(edit), contextSnapshotId: v.optional(v.id("agentContexts")) };
export const applyResult = v.union(v.object({ status: v.literal("applied"), version: v.number(), operationGroupId: v.id("agentChanges") }), v.object({ status: v.literal("conflict"), currentVersion: v.number() }));
export const applyRequest = v.object(applyArgs);
