import { getAuthUserId } from "@convex-dev/auth/server";
import { AuthoredStep } from "@pluribus/editor/protocol";
import { documentSchema as schema } from "@pluribus/editor/schema";
import { AddMarkStep, RemoveMarkStep, Step } from "@tiptap/pm/transform";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { components } from "../_generated/api";
import { requireWorkspace } from "../workspaces/Access";
import { requireDocument } from "../documents/Access";
import { mappedInverse } from "../documents/Authorship";
import { materialize, submitDocumentSteps } from "../documents/Sync";
import { hashSecret } from "../documents/Authors";
/** Explicit user-authorized reversal; agent credentials are never exposed or impersonated. */
export async function undoAgentChange(ctx: MutationCtx,args:{changeId:Id<"agentChanges">;requestId:string}) {
 const change=await ctx.db.get(args.changeId), userId=await getAuthUserId(ctx);
 if(!change || change.userId!==userId)throw new Error("Agent change belongs to another user");
 await requireWorkspace(ctx,change.workspaceId);
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(args.requestId))throw new Error("Invalid request identity");
 const prior=await ctx.db.query("agentUndoRequests").withIndex("by_user_request",q=>q.eq("userId",change.userId).eq("requestId",args.requestId)).unique();
 if(prior) {if(prior.changeId!==change._id)throw new Error("Request identity reused");return {version:prior.version};}
 if(change.undone)throw new Error("Agent change already undone");
 const scope=`${change.documentId}:${change.generation}`;
 await requireDocument(ctx,scope,true);
 const latest=await ctx.runQuery(components.prosemirrorSync.lib.latestVersion,{id:change.documentId});if(latest===null)throw new Error("Document unavailable");
 if(latest-change.version>1000)throw new Error("Too much intervening history for safe undo");
 // Authorship does not attribute formatting. Refuse this ambiguous case conservatively.
 let cursor=change.version;
 while(cursor<latest) {
  const batch=await ctx.runQuery(components.prosemirrorSync.lib.getSteps,{id:change.documentId,version:cursor});
  const values=batch.steps.slice(0,latest-cursor);if(!values.length)throw new Error("Undo history unavailable");
  for(const value of values) {const wrapped=Step.fromJSON(schema,JSON.parse(value));const step=wrapped instanceof AuthoredStep ? wrapped.inner : wrapped;if(step instanceof AddMarkStep || step instanceof RemoveMarkStep)throw new Error("Formatting changed; cannot safely undo this agent edit");}
  cursor+=values.length;
 }
 let doc=(await materialize(ctx,change.documentId,latest)).doc;
 const steps:AuthoredStep[]=[];
 for(const operation of [...change.operations].reverse()) {
  const receipt=await ctx.db.query("documentOperations").withIndex("by_document_operation",q=>q.eq("document",change.documentId).eq("operation",operation)).unique();
  if(!receipt || receipt.revertedBy || receipt.author!==change.author || receipt.session!==change.session || receipt.scope!==scope)throw new Error("Agent inverse evidence unavailable");
  const inverse=await mappedInverse(ctx,change.documentId,{version:receipt.version,proof:receipt.inverse},latest,steps);
  if(!inverse)throw new Error("Agent change conflicts with later edits");
  inverse.getMap().forEach((from,to)=>{
   if(to<=from)return;
   doc.nodesBetween(from,to,(node,pos)=>{
    if(node.isText) {if(node.marks.find(m=>m.type.name==="authorship")?.attrs.author!==change.author)throw new Error("Undo would remove another writer's text");return;}
    const crossesBoundary=(pos>=from && pos<to) || (pos+node.nodeSize>from && pos+node.nodeSize<=to);
    const original=change.createdStructures?.find(s=>s.id===node.attrs.paragraphId);
    if(crossesBoundary && (!original || original.type!==node.type.name || original.attrs!==JSON.stringify(node.attrs)))throw new Error("Undo would remove a later structural edit");
   });
  });
  const result=inverse.apply(doc);if(!result.doc)throw new Error("Agent change conflicts with later edits");
  doc=result.doc;steps.push(new AuthoredStep(inverse,crypto.randomUUID(),operation));
 }
 const author=await ctx.db.query("documentAuthors").withIndex("by_user",q=>q.eq("userId",change.userId)).first();
 const humanAuthor=author?._id ?? await ctx.db.insert("documentAuthors",{kind:"user",userId:change.userId,label:`Member ${change.userId.slice(-4)}`});
 const session=await ctx.db.insert("documentAuthorSessions",{author:humanAuthor,scope,secretHash:await hashSecret(crypto.randomUUID())});
 await submitDocumentSteps(ctx,{id:scope,version:latest,clientId:`review:${change.userId}`,steps:steps.map(s=>JSON.stringify(s.toJSON())),protocol:1},{userId:change.userId,author:humanAuthor,session,restoration:{author:change.author,session:change.session,operations:change.operations}});
 const version=latest+steps.length;
 await ctx.db.patch(change._id,{undone:true});
 await ctx.db.insert("agentUndoRequests",{userId:change.userId,requestId:args.requestId,changeId:change._id,version});
 return {version};
}
