import { getAuthUserId } from "@convex-dev/auth/server";
import { Transform } from "@tiptap/pm/transform";
import { documentSchema } from "@pluribus/editor/schema";
import { documentLimits } from "@pluribus/core/canvas/domain";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { spatialDocuments } from "../canvas/Documents";
import { materialize } from "../documents/Sync";
import {
  landingDemoSourceGeometry,
  landingDemoSourceUrl,
  requestLandingDemoSource,
} from "../sources/Persistence";

const carolMessage =
  "Hello, Carol. This is a recording. At the tone, you can leave a message to request anything you might need. We'll do our best to provide it. Our feelings for you haven't changed, Carol. But after everything that's happened, we just need a little space.";
const carolGeometry = { x: 70, y: 100, width: 510, height: 355 };

async function resetLandingDemo(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
) {
  // The original card is the first spatial card. Keep its editor identity so
  // reloads neither duplicate ProseMirror documents nor retain edited text.
  const seed = (
    await ctx.db
      .query("canvasDocuments")
      .withIndex("by_canvas", (q) => q.eq("canvas", workspaceId))
      .take(2)
  ).find((row) => row.role === "card");
  if (!seed || !seed.documentId || !("x" in seed))
    throw new Error("Demo document unavailable");

  const cards = await spatialDocuments(
    ctx,
    workspaceId,
    documentLimits.maxCount,
  );
  for (const card of cards) {
    if (card._id !== seed._id)
      await ctx.db.patch(card._id, {
        removed: true,
        generation: card.generation + 1,
        activeDeletion: undefined,
      });
  }
  await ctx.db.patch(seed._id, {
    ...carolGeometry,
    removed: false,
    generation: seed.generation + 1,
    activeDeletion: undefined,
  });

  const version = await ctx.runQuery(
    components.prosemirrorSync.lib.latestVersion,
    {
      id: seed.documentId,
    },
  );
  if (version === null) throw new Error("Demo document unavailable");
  const current = (await materialize(ctx, seed.documentId, version)).doc;
  const target = documentSchema.nodeFromJSON({
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: {
          paragraphId:
            current.firstChild?.attrs.paragraphId ?? crypto.randomUUID(),
        },
        content: [{ type: "text", text: carolMessage }],
      },
    ],
  });
  if (!current.eq(target)) {
    const transform = new Transform(current).replaceWith(
      0,
      current.content.size,
      target.content,
    );
    const result = await ctx.runMutation(
      components.prosemirrorSync.lib.submitSteps,
      {
        id: seed.documentId,
        version,
        clientId: "landing-demo-reset",
        steps: transform.steps.map((step) => JSON.stringify(step.toJSON())),
      },
    );
    if (result.status !== "synced") throw new Error("Demo reset conflicted");
    await ctx.runMutation(components.prosemirrorSync.lib.submitSnapshot, {
      id: seed.documentId,
      version: version + transform.steps.length,
      content: JSON.stringify(target.toJSON()),
      pruneSnapshots: true,
    });
  }

  const sources = await ctx.db
    .query("sources")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .take(21);
  const source = sources.find((row) => row.url === landingDemoSourceUrl);
  for (const row of sources) {
    if (row._id !== source?._id && !row.removed)
      await ctx.db.patch(row._id, {
        removed: true,
        generation: (row.generation ?? 1) + 1,
        activeDeletion: undefined,
      });
  }
  if (source)
    await ctx.db.patch(source._id, {
      geometry: landingDemoSourceGeometry,
      removed: undefined,
      generation: (source.generation ?? 1) + 1,
      activeDeletion: undefined,
    });
  else await requestLandingDemoSource(ctx, workspaceId, userId);

  const images = await ctx.db
    .query("canvasImages")
    .withIndex("by_workspace_removed", (q) =>
      q.eq("workspaceId", workspaceId).eq("removed", false),
    )
    .take(100);
  for (const image of images)
    await ctx.db.patch(image._id, {
      removed: true,
      generation: image.generation + 1,
      activeDeletion: undefined,
    });
}

/** One private workspace per Convex Auth guest, with normal canvas membership. */
export async function ensureLandingDemo(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get("users", userId) : null;
  if (!userId || user?.isAnonymous !== true)
    throw new Error("Anonymous session required");

  const slug = `landing-demo-${userId}`;
  const existing = await ctx.db
    .query("workspaces")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (existing) {
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", existing._id).eq("userId", userId),
      )
      .unique();
    if (
      existing.demo !== "landing" ||
      (existing.demoOwnerId !== undefined && existing.demoOwnerId !== userId) ||
      !member ||
      member.shareLinkId
    )
      throw new Error("Demo workspace unavailable");
    if (!existing.demoOwnerId)
      await ctx.db.patch(existing._id, { demoOwnerId: userId });
    await resetLandingDemo(ctx, existing._id, userId);
    return existing._id;
  }

  const workspaceId = await ctx.db.insert("workspaces", {
    slug,
    name: "Your canvas demo",
    demo: "landing",
    demoOwnerId: userId,
  });
  await ctx.db.insert("workspaceMembers", { workspaceId, userId });
  const element = await ctx.db.insert("canvasDocuments", {
    canvas: workspaceId,
    ...carolGeometry,
    role: "card",
    removed: false,
    generation: 1,
  });
  const documentId = await ctx.db.insert("documents", {
    key: `canvas:${element}`,
    access: "workspace",
    workspaceId,
    paragraphs: 1,
    element,
  });
  await ctx.db.patch(element, { documentId });
  await ctx.runMutation(components.prosemirrorSync.lib.submitSnapshot, {
    id: documentId,
    version: 1,
    content: JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { paragraphId: crypto.randomUUID() },
          content: [{ type: "text", text: carolMessage }],
        },
      ],
    }),
  });

  await requestLandingDemoSource(ctx, workspaceId, userId);
  return workspaceId;
}
