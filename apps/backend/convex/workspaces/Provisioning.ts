import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/** Panel documents retain canvas ownership without fabricated spatial geometry. */
export async function createPanelDocument(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  role: { kind: "main" } | { kind: "reply"; threadId: Id<"inboxThreads"> },
) {
  const documentId = await ctx.db.insert("documents", {
    key: `${workspaceId}:${role.kind}:${role.kind === "reply" ? role.threadId : "main"}`,
    access: "workspace",
    paragraphs: 1,
    workspaceId,
  });
  const element = await ctx.db.insert("canvasDocuments", {
    canvas: workspaceId,
    documentId,
    removed: false,
    generation: 1,
    ...(role.kind === "main"
      ? { role: "main" as const }
      : { role: "reply" as const, threadId: role.threadId }),
  });
  await ctx.db.patch(documentId, { element });
  await ctx.runMutation(components.prosemirrorSync.lib.submitSnapshot, {
    id: documentId,
    version: 1,
    content: JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", attrs: { paragraphId: crypto.randomUUID() } },
      ],
    }),
  });
  return documentId;
}
/** Explicit operator-only provisioning; never infers an administrator from first login. */
export const provision = internalMutation({
  args: {
    slug: v.string(),
    name: v.string(),
    assignments: v.array(v.object({ email: v.string(), admin: v.boolean() })),
  },
  returns: v.id("workspaces"),
  handler: async (ctx, args) => {
    if (
      !/^[a-z0-9-]{1,64}$/.test(args.slug) ||
      !args.name.trim() ||
      args.name.length > 100 ||
      args.assignments.length > 32
    )
      throw new Error("Invalid demo provisioning");
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    const workspaceId =
      existing?._id ??
      (await ctx.db.insert("workspaces", { slug: args.slug, name: args.name }));
    for (const assignment of args.assignments) {
      const email = assignment.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error("Invalid assigned email");
      const prior = await ctx.db
        .query("workspaceAssignments")
        .withIndex("by_workspace_email", (q) =>
          q.eq("workspaceId", workspaceId).eq("email", email),
        )
        .unique();
      if (!prior)
        await ctx.db.insert("workspaceAssignments", {
          workspaceId,
          email,
          admin: assignment.admin,
        });
      else if (prior.admin !== assignment.admin)
        throw new Error("Existing assignment differs; change it explicitly");
    }
    await ctx.runMutation(internal.inbox.Provisioning.ensure, { workspaceId });
    return workspaceId;
  },
});

/** Explicit operator approval upgrades an existing preassignment; verified login claims the role. */
export const authorizeAdministrator = internalMutation({
  args: { workspaceId: v.id("workspaces"), email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const assignment = await ctx.db
      .query("workspaceAssignments")
      .withIndex("by_workspace_email", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("email", args.email.trim().toLowerCase()),
      )
      .unique();
    if (!assignment || !(await ctx.db.get(args.workspaceId)))
      throw new Error("Existing assignment required");
    await ctx.db.patch(assignment._id, { admin: true });
    return null;
  },
});
