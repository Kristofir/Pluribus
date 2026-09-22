import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  context,
  credentials,
  activity,
  member,
  browserCredential,
} from "./presence/Model";
import * as handlers from "./presence/Handlers";
import { agentRoster as readAgentRoster } from "./presence/Agents";
/** Presence membership is component-owned; guest IDs are display identities, not authorization. */
export const join = mutation({
  args: {
    context,
    guestId: v.string(),
    tabId: v.string(),
    browser: browserCredential,
  },
  returns: v.object({
    id: v.id("presenceParticipations"),
    capability: v.string(),
  }),
  handler: handlers.join,
});
export const claimBrowser = mutation({
  args: {
    secret: v.string(),
    epoch: v.number(),
    tabId: v.string(),
    account: v.union(v.id("users"), v.null()),
  },
  returns: v.union(browserCredential, v.null()),
  handler: handlers.claimBrowser,
});
export const releaseBrowser = mutation({
  args: { browser: browserCredential },
  returns: v.null(),
  handler: handlers.releaseBrowser,
});
export const heartbeat = mutation({
  args: credentials,
  returns: v.boolean(),
  handler: handlers.heartbeat,
});
export const lifecycle = mutation({
  args: {
    ...credentials,
    sequence: v.number(),
    hidden: v.boolean(),
    focused: v.boolean(),
  },
  returns: v.boolean(),
  handler: handlers.lifecycle,
});
export const leave = mutation({
  args: credentials,
  returns: v.null(),
  handler: handlers.leave,
});
export const roster = query({
  args: { context },
  returns: v.array(member),
  handler: handlers.roster,
});
/** Recently authenticated MCP agents in this workspace, separate from browser sessions. */
export const agents = query({
  args: { context },
  returns: v.array(
    v.object({
      id: v.id("agentGrants"),
      label: v.string(),
    }),
  ),
  handler: readAgentRoster,
});
export const activities = query({
  args: { context },
  returns: v.array(
    v.object({
      participationId: v.id("presenceParticipations"),
      sequence: v.number(),
      activity,
    }),
  ),
  handler: handlers.activities,
});
export const publish = mutation({
  args: { ...credentials, sequence: v.number(), activity },
  returns: v.boolean(),
  handler: handlers.publish,
});
