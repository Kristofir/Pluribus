import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireWorkspace } from "../workspaces/Access";
import { readParagraphs } from "../documents/Paragraphs";
import { requireGrant } from "./Access";
export async function prepareContext(ctx:MutationCtx,args:{workspaceId:Id<"workspaces">;elementIds:(Id<"rectangles">|Id<"canvasDocuments">|Id<"sources">)[];passages:{documentId:Id<"documents">;paragraphId:string;version:number}[]}) {
 const {userId}=await requireWorkspace(ctx,args.workspaceId);
 if(args.elementIds.length>30 || args.passages.length>30 || !(args.elementIds.length+args.passages.length))throw new Error("Select between 1 and 30 cards or passages per kind");
 const documentIds=new Set<Id<"documents">>();
 const elements=[];
 for(const id of [...new Set(args.elementIds)]) {
  const sourceId=ctx.db.normalizeId("sources",id);
  if(sourceId){const source=await ctx.db.get(sourceId);if(!source || source.workspaceId!==args.workspaceId || source.status!=="ready" || !source.capture)throw new Error("Selected source unavailable");elements.push({elementId:id,kind:"source",url:source.url,revision:source.revision,capture:source.capture});continue;}
  const spatialId=ctx.db.normalizeId("rectangles",id)??ctx.db.normalizeId("canvasDocuments",id);if(!spatialId)throw new Error("Invalid selected Element");
  const element=await ctx.db.get(spatialId);
  if(!element || !("x" in element) || element.removed || ("canvas" in element ? element.canvas!==args.workspaceId : element.workspaceId!==args.workspaceId))throw new Error("Selected Element unavailable");
  if("canvas" in element) {
   if(!element.documentId)throw new Error("Document unavailable");
   const doc=await readParagraphs(ctx,element.documentId);documentIds.add(element.documentId);
   elements.push({elementId:id,kind:"document",document:doc});
  } else elements.push({elementId:id,kind:"rectangle",geometry:{x:element.x,y:element.y,width:element.width,height:element.height},color:element.color,generation:element.generation??1});
 }
 const passages=[];
 for(const passage of args.passages) {
  const current=await readParagraphs(ctx,passage.documentId);
  if(current.canvasId!==args.workspaceId)throw new Error("Passage outside workspace");
  if(current.version!==passage.version)throw new Error("Selected passage changed; select it again");
  const paragraph=current.paragraphs.find(p=>p.paragraphId===passage.paragraphId);
  if(!paragraph)throw new Error("Selected paragraph no longer exists");
  documentIds.add(passage.documentId);passages.push({...passage,generation:current.generation,text:paragraph.text});
 }
 const content=JSON.stringify({elements,passages});if(new TextEncoder().encode(content).byteLength>100000)throw new Error("Selected context too large");
 return ctx.db.insert("agentContexts",{workspaceId:args.workspaceId,userId,documentIds:[...documentIds],content});
}
export async function readContext(ctx:QueryCtx,args:{token:string;contextSnapshotId:Id<"agentContexts">}) {
 const grant=await requireGrant(ctx,args.token), context=await ctx.db.get(args.contextSnapshotId);
 if(!context || context.workspaceId!==grant.workspaceId || context.userId!==grant.userId || context.documentIds.some(id=>!grant.documentIds.includes(id)))throw new Error("Context outside grant");
 return context.content;
}
