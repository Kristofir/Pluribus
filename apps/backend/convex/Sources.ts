import { v } from "convex/values";
import { query,mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireWorkspace } from "./workspaces/Access";
import { publicSourceUrl } from "./sources/Firecrawl";
import { sourceStatus,capture } from "./sources/Model";
export const list=query({args:{workspaceId:v.id("workspaces")},returns:v.array(v.object({id:v.id("sources"),canvasId:v.string(),url:v.string(),status:sourceStatus,capture:v.optional(capture),error:v.optional(v.string())})),handler:async(ctx,args)=>{await requireWorkspace(ctx,args.workspaceId);const rows=await ctx.db.query("sources").withIndex("by_workspace",q=>q.eq("workspaceId",args.workspaceId)).take(20);return rows.map(r=>({id:r._id,canvasId:String(r.workspaceId),url:r.url,status:r.status,capture:r.capture,error:r.error}));}});
export const request=mutation({args:{workspaceId:v.id("workspaces"),url:v.string(),prompt:v.optional(v.string()),sourceId:v.optional(v.id("sources"))},returns:v.id("sources"),handler:async(ctx,args)=>{
 const {userId}=await requireWorkspace(ctx,args.workspaceId),url=publicSourceUrl(args.url);if((args.prompt?.length??0)>2000)throw new Error("Extraction prompt too long");
 const prior=args.sourceId ? await ctx.db.get(args.sourceId) : null;if(args.sourceId && (!prior || prior.workspaceId!==args.workspaceId))throw new Error("Source outside workspace");
 if(!prior && (await ctx.db.query("sources").withIndex("by_workspace",q=>q.eq("workspaceId",args.workspaceId)).take(20)).length>=20)throw new Error("This demo supports 20 sources");
 const revision=(prior?.revision??0)+1,value={workspaceId:args.workspaceId,userId,url,prompt:args.prompt,status:"queued" as const,revision,capture:undefined,error:undefined};
 const id=prior?._id??await ctx.db.insert("sources",value);if(prior)await ctx.db.patch(id,value);
 await ctx.scheduler.runAfter(0,internal.sources.Jobs.fetch,{id,revision});return id;
}});
