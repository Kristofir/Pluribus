import { v } from "convex/values";
export const context = v.union(
  v.object({ kind: v.literal("canvas"), id: v.string() }),
  v.object({ kind: v.literal("document"), id: v.id("documents") }),
);
export const activity = v.union(
  v.object({
    kind: v.literal("pointer"),
    point: v.union(v.null(), v.object({ x: v.number(), y: v.number() })),
  }),
  v.object({ kind: v.literal("selection"), elements: v.array(v.string()) }),
  v.object({
    kind: v.literal("manipulation"),
    elements: v.array(v.string()),
    operation: v.union(v.null(), v.literal("drag"), v.literal("resize")),
  }),
  v.object({
    kind: v.literal("text"),
    range: v.union(
      v.null(),
      v.object({ version: v.number(), anchor: v.number(), head: v.number() }),
    ),
  }),
);
export const channel = v.union(
  v.literal("pointer"),
  v.literal("selection"),
  v.literal("manipulation"),
  v.literal("text"),
);
export const participation = v.object({
  context,
  contextKey: v.string(),
  guestId: v.string(),
  tabId: v.string(),
  capability: v.string(),
  generation: v.optional(v.number()),
  componentToken: v.string(),
  hidden: v.boolean(),
  focused: v.boolean(),
  lifecycleSequence: v.number(),
});
export const storedActivity = v.object({
  participationId: v.id("presenceParticipations"),
  contextKey: v.string(),
  channel,
  sequence: v.number(),
  activity,
});
export const credentials = {
  context,
  id: v.id("presenceParticipations"),
  capability: v.string(),
};
export const member = v.object({
  id: v.id("presenceParticipations"),
  guestId: v.string(),
  tabId: v.string(),
  hidden: v.boolean(),
  focused: v.boolean(),
});
