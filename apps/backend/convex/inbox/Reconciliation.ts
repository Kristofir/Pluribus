import { v } from "convex/values";
import { internalAction,internalQuery,internalMutation,type MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireWorkspaceMember } from "../workspaces/Access";
import { findSentIntent } from "./AgentMail";
/** A sent provider message carrying our exact intent header is positive acceptance evidence. */
export async function reconcileMessages(ctx:MutationCtx,thread:Doc<"inboxThreads">) {
 for(const message of thread.messages) {
  if(message.direction!=="outgoing" || !message.intentId)continue;
  const id=ctx.db.normalizeId("sendIntents",message.intentId);if(!id)continue;
  const intent=await ctx.db.get(id);
  if(intent && intent.threadId===thread._id && intent.inboxId===thread.inboxId && ["unknown","sending"].includes(intent.status))await ctx.db.patch(id,{status:"sent",sentMessageId:message.id,error:undefined,reconciling:false});
 }
}
const identity={intentId:v.id("sendIntents"),userId:v.id("users")};
export const request=internalQuery({args:identity,returns:v.union(v.null(),v.object({inboxId:v.string(),threadId:v.string(),intentId:v.string()})),handler:async(ctx,args)=>{
 const intent=await ctx.db.get(args.intentId);if(!intent || intent.status!=="unknown" || !intent.reconciling)return null;
 await requireWorkspaceMember(ctx,intent.workspaceId,args.userId);
 const inbox=await ctx.db.get(intent.inboxId),thread=await ctx.db.get(intent.threadId);if(!inbox || !thread || inbox.workspaceId!==intent.workspaceId || thread.inboxId!==inbox._id)throw new Error("Delivery ownership invalid");
 return {inboxId:inbox.providerInboxId,threadId:thread.providerId,intentId:String(intent._id)};
}});
export const complete=internalMutation({args:{intentId:v.id("sendIntents"),messageId:v.union(v.string(),v.null()),failed:v.boolean()},returns:v.null(),handler:async(ctx,args)=>{
 const row=await ctx.db.get(args.intentId);if(!row || row.status!=="unknown")return null;
 await ctx.db.patch(row._id,args.messageId ? {status:"sent",sentMessageId:args.messageId,error:undefined,reconciling:false}:{reconciling:false,error:args.failed ? "Could not check provider delivery. No resend was attempted." : "No matching sent-message evidence found in the latest 20 messages. Delivery remains unknown; no resend was attempted."});return null;
}});
export const check=internalAction({args:identity,returns:v.null(),handler:async(ctx,args)=>{try{const request=await ctx.runQuery(internal.inbox.Reconciliation.request,args);if(!request)return null;const messageId=await findSentIntent(request);await ctx.runMutation(internal.inbox.Reconciliation.complete,{intentId:args.intentId,messageId,failed:false});}catch{await ctx.runMutation(internal.inbox.Reconciliation.complete,{intentId:args.intentId,messageId:null,failed:true});}return null;}});
