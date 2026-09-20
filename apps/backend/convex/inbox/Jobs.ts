import { reconcileMessages } from "./Reconciliation";
import { v } from "convex/values";
import { internalMutation,internalAction,internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireWorkspaceMember } from "../workspaces/Access";
import { readInbox } from "./AgentMail";
import { thread } from "./Model";
/** Operator chooses the workspace explicitly; a configured mailbox is never shared by fallback. */
export const bindConfigured=internalMutation({args:{workspaceId:v.id("workspaces")},returns:v.id("workspaceInboxes"),handler:async(ctx,args)=>{
 if(!(await ctx.db.get(args.workspaceId)))throw new Error("Workspace unavailable");
 const providerInboxId=process.env.AGENTMAIL_INBOX_ID;if(!providerInboxId)throw new Error("AGENTMAIL_INBOX_ID is not configured");
 const prior=await ctx.db.query("workspaceInboxes").withIndex("by_provider",q=>q.eq("providerInboxId",providerInboxId)).unique();
 if(prior && prior.workspaceId!==args.workspaceId)throw new Error("Mailbox already assigned to another workspace");
 const current=await ctx.db.query("workspaceInboxes").withIndex("by_workspace",q=>q.eq("workspaceId",args.workspaceId)).unique();if(current && current.providerInboxId!==providerInboxId)throw new Error("Workspace already has a different inbox");
 return prior?._id??await ctx.db.insert("workspaceInboxes",{workspaceId:args.workspaceId,providerInboxId,revision:0,status:"idle"});
}});
const identity={inboxId:v.id("workspaceInboxes"),revision:v.number(),userId:v.id("users")};
export const request=internalQuery({args:identity,returns:v.union(v.null(),v.string()),handler:async(ctx,args)=>{const row=await ctx.db.get(args.inboxId);if(!row || row.revision!==args.revision || row.status!=="loading")return null;await requireWorkspaceMember(ctx,row.workspaceId,args.userId);return row.providerInboxId;}});
export const complete=internalMutation({args:{...identity,threads:v.optional(v.array(thread)),error:v.optional(v.string())},returns:v.null(),handler:async(ctx,args)=>{
 const inbox=await ctx.db.get(args.inboxId);if(!inbox || inbox.revision!==args.revision || inbox.status!=="loading")return null;
 if(args.threads) {
  if(args.threads.length>10 || JSON.stringify(args.threads).length>500000)throw new Error("Inbox result too large");
  for(const row of args.threads){const prior=await ctx.db.query("inboxThreads").withIndex("by_inbox_provider",q=>q.eq("inboxId",inbox._id).eq("providerId",row.providerId)).unique();const value={...row,workspaceId:inbox.workspaceId,inboxId:inbox._id};const id=prior?._id??await ctx.db.insert("inboxThreads",value);if(prior)await ctx.db.patch(id,value);const saved=await ctx.db.get(id);if(saved)await reconcileMessages(ctx,saved);}
  await ctx.db.patch(inbox._id,{status:"ready",error:undefined});
 } else await ctx.db.patch(inbox._id,{status:"failed",error:args.error??"Inbox refresh failed"});
 return null;
}});
export const refresh=internalAction({args:identity,returns:v.null(),handler:async(ctx,args)=>{try{const id=await ctx.runQuery(internal.inbox.Jobs.request,args);if(!id)return null;const threads=await readInbox(id);await ctx.runMutation(internal.inbox.Jobs.complete,{...args,threads});}catch{await ctx.runMutation(internal.inbox.Jobs.complete,{...args,error:"Inbox unavailable. Check access and AgentMail configuration."});}return null;}});
