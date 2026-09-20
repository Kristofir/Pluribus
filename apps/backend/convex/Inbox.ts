import { v } from "convex/values";
import { query,mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireWorkspace } from "./workspaces/Access";
import { requireThread,openDraft,savedDraft } from "./inbox/Drafts";
import { requestSend } from "./inbox/Sends";
import { message,sendStatus } from "./inbox/Model";
export const list=query({args:{workspaceId:v.id("workspaces")},returns:v.object({status:v.union(v.literal("unconfigured"),v.literal("idle"),v.literal("loading"),v.literal("ready"),v.literal("failed")),error:v.optional(v.string()),threads:v.array(v.object({id:v.id("inboxThreads"),workspaceId:v.id("workspaces"),subject:v.string(),messages:v.array(message),truncated:v.boolean(),draftDocumentId:v.optional(v.id("documents"))}))}),handler:async(ctx,args)=>{
 await requireWorkspace(ctx,args.workspaceId);const inbox=await ctx.db.query("workspaceInboxes").withIndex("by_workspace",q=>q.eq("workspaceId",args.workspaceId)).unique();
 const rows=await ctx.db.query("inboxThreads").withIndex("by_workspace",q=>q.eq("workspaceId",args.workspaceId)).order("desc").take(20);
 return {status:inbox?.status??("unconfigured" as const),error:inbox?.error,threads:rows.map(r=>({id:r._id,workspaceId:r.workspaceId,subject:r.subject,messages:r.messages,truncated:r.truncated,draftDocumentId:r.draftDocumentId}))};
}});
export const refresh=mutation({args:{workspaceId:v.id("workspaces")},returns:v.null(),handler:async(ctx,args)=>{const {userId}=await requireWorkspace(ctx,args.workspaceId);const inbox=await ctx.db.query("workspaceInboxes").withIndex("by_workspace",q=>q.eq("workspaceId",args.workspaceId)).unique();if(!inbox)throw new Error("No mailbox assigned to this workspace");const revision=inbox.revision+1;await ctx.db.patch(inbox._id,{status:"loading",revision,error:undefined});await ctx.scheduler.runAfter(0,internal.inbox.Jobs.refresh,{inboxId:inbox._id,revision,userId});return null;}});
export const draft=mutation({args:{threadId:v.id("inboxThreads")},returns:v.id("documents"),handler:openDraft});
export const review=query({args:{threadId:v.id("inboxThreads")},returns:v.object({documentId:v.id("documents"),generation:v.number(),version:v.number(),text:v.string(),reviewedMessageId:v.union(v.string(),v.null()),recipients:v.array(v.string())}),handler:(ctx,args)=>savedDraft(ctx,args.threadId)});
export const send=mutation({args:{threadId:v.id("inboxThreads"),requestId:v.string(),reviewedMessageId:v.string(),draftVersion:v.number(),text:v.string(),recipients:v.array(v.string())},returns:v.id("sendIntents"),handler:requestSend});
export const delivery=query({args:{threadId:v.id("inboxThreads")},returns:v.union(v.null(),v.object({intentId:v.id("sendIntents"),draftVersion:v.number(),status:sendStatus,error:v.optional(v.string())})),handler:async(ctx,args)=>{await requireThread(ctx,args.threadId);const row=await ctx.db.query("sendIntents").withIndex("by_thread",q=>q.eq("threadId",args.threadId)).order("desc").first();return row ? {intentId:row._id,draftVersion:row.draftVersion,status:row.status,error:row.error}:null;}});

/** Read-only provider reconciliation can establish sent, never infer safe resend from absence. */
export const reconcile=mutation({args:{threadId:v.id("inboxThreads")},returns:v.null(),handler:async(ctx,args)=>{
 const thread=await requireThread(ctx,args.threadId),{userId}=await requireWorkspace(ctx,thread.workspaceId);
 const intent=await ctx.db.query("sendIntents").withIndex("by_thread",q=>q.eq("threadId",thread._id)).order("desc").first();
 if(!intent || intent.status!=="unknown" || intent.reconciling)return null;
 await ctx.db.patch(intent._id,{reconciling:true});await ctx.scheduler.runAfter(0,internal.inbox.Reconciliation.check,{intentId:intent._id,userId});return null;
}});
