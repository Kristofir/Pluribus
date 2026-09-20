import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalAction,internalMutation,type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireWorkspaceMember } from "../workspaces/Access";
import { assertReviewedDraft,canDispatchSend } from "@pluribus/core/inbox/domain";
import { deliverIntent } from "@pluribus/core/inbox/delivery";
import { requireThread,savedDraft } from "./Drafts";
import { sendReply } from "./AgentMail";
/** Freeze exactly the reviewed canonical draft and visible recipients before dispatch. */
export async function requestSend(ctx:MutationCtx,args:{threadId:Id<"inboxThreads">;requestId:string;reviewedMessageId:string;draftVersion:number;text:string;recipients:string[]}) {
 const thread=await requireThread(ctx,args.threadId),userId=await getAuthUserId(ctx);if(!userId)throw new Error("Sign in to send");
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(args.requestId))throw new Error("Invalid request identity");
 const prior=await ctx.db.query("sendIntents").withIndex("by_user_request",q=>q.eq("userId",userId).eq("requestId",args.requestId)).unique();
 if(prior){if(prior.threadId!==args.threadId || prior.providerMessageId!==args.reviewedMessageId || prior.draftVersion!==args.draftVersion || prior.text!==args.text || JSON.stringify(prior.recipients)!==JSON.stringify(args.recipients))throw new Error("Send identity reused");return prior._id;}
 const previous=await ctx.db.query("sendIntents").withIndex("by_thread",q=>q.eq("threadId",thread._id)).order("desc").first();
 if(previous && ["pending","sending","unknown"].includes(previous.status))throw new Error("Resolve the existing delivery before sending again");
 const draft=await savedDraft(ctx,args.threadId);
 assertReviewedDraft(draft,{version:args.draftVersion,text:args.text,recipients:args.recipients});
 if(draft.reviewedMessageId!==args.reviewedMessageId || !draft.reviewedMessageId)throw new Error("Reply target changed; review the latest received message");
 const intentId=await ctx.db.insert("sendIntents",{workspaceId:thread.workspaceId,userId,threadId:thread._id,inboxId:thread.inboxId,providerMessageId:draft.reviewedMessageId,documentId:draft.documentId,generation:draft.generation,requestId:args.requestId,draftVersion:draft.version,text:draft.text,recipients:args.recipients,status:"pending"});
 await ctx.scheduler.runAfter(0,internal.inbox.Sends.dispatch,{intentId});return intentId;
}
const identity={intentId:v.id("sendIntents")};
export const claim=internalMutation({args:identity,returns:v.union(v.null(),v.object({inboxId:v.string(),messageId:v.string(),text:v.string(),recipients:v.array(v.string()),intentId:v.string()})),handler:async(ctx,args)=>{
 const row=await ctx.db.get(args.intentId);if(!row || !canDispatchSend(row.status))return null;
 try{await requireWorkspaceMember(ctx,row.workspaceId,row.userId);}catch{await ctx.db.patch(row._id,{status:"failed",error:"Workspace access changed before dispatch"});return null;}
 const inbox=await ctx.db.get(row.inboxId);if(!inbox || inbox.workspaceId!==row.workspaceId || !process.env.AGENTMAIL_API_KEY){await ctx.db.patch(row._id,{status:"failed",error:"AgentMail is not configured for this workspace"});return null;}
 await ctx.db.patch(row._id,{status:"sending"});await ctx.scheduler.runAfter(60000,internal.inbox.Sends.expire,args);
 return {inboxId:inbox.providerInboxId,messageId:row.providerMessageId,text:row.text,recipients:row.recipients,intentId:String(row._id)};
}});
export const complete=internalMutation({args:{...identity,status:v.union(v.literal("sent"),v.literal("failed"),v.literal("unknown")),messageId:v.optional(v.string()),error:v.optional(v.string())},returns:v.null(),handler:async(ctx,args)=>{const row=await ctx.db.get(args.intentId);if(!row || !["sending","unknown"].includes(row.status))return null;await ctx.db.patch(row._id,{status:args.status,sentMessageId:args.messageId,error:args.error});return null;}});
export const expire=internalMutation({args:identity,returns:v.null(),handler:async(ctx,args)=>{const row=await ctx.db.get(args.intentId);if(row?.status==="sending")await ctx.db.patch(row._id,{status:"unknown",error:"Delivery timed out. Check the inbox before sending anything else."});return null;}});
export const dispatch=internalAction({args:identity,returns:v.null(),handler:async(ctx,args)=>{await deliverIntent({claim:()=>ctx.runMutation(internal.inbox.Sends.claim,args),send:sendReply,finish:result=>ctx.runMutation(internal.inbox.Sends.complete,{...args,...result}).then(()=>undefined)});return null;}});
