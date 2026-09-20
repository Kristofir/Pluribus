import { assertAgentEdits } from "@pluribus/core/documents/agentEdits";
import { paragraphRows } from "@pluribus/editor/paragraphs";
import { documentSchema as schema } from "@pluribus/editor/schema";
import { AuthoredStep } from "@pluribus/editor/protocol";
import { Transform } from "@tiptap/pm/transform";
import type { Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { components } from "../_generated/api";
import { applyRequest } from "./Model";
import { requireGrant } from "./Access";
import { requireDocument } from "../documents/Access";
import { materialize, submitDocumentSteps } from "../documents/Sync";
import { hashSecret } from "../documents/Authors";
import type { Id } from "../_generated/dataModel";

export async function readAgentDocument(ctx: QueryCtx,args:{token:string;documentId:Id<"documents">}) {
 const grant=await requireGrant(ctx,args.token,args.documentId);
 const document=await requireDocument(ctx,args.documentId,false,grant.userId);
 if(document.workspaceId!==grant.workspaceId || !document.element) throw new Error("Document outside grant");
 const child=await ctx.db.get(document.element); if(!child || child.removed)throw new Error("Document unavailable");
 const version=await ctx.runQuery(components.prosemirrorSync.lib.latestVersion,{id:document._id}); if(version===null)throw new Error("Document unavailable");
 return {documentId:document._id,generation:child.generation,version,paragraphs:paragraphRows((await materialize(ctx,document._id,version)).doc).map(p=>({paragraphId:p.id,text:p.text}))};
}
/** Exact-version paragraph commands commit text, author evidence and immutable replay outcome together. */
export async function applyAgentEdit(ctx: MutationCtx,args:Infer<typeof applyRequest>) {
 const grant=await requireGrant(ctx,args.token,args.documentId);
 const document=await requireDocument(ctx,args.documentId,false,grant.userId);
 if(document.workspaceId!==grant.workspaceId || !document.paragraphs)throw new Error("Document outside grant");
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(args.requestId))throw new Error("Invalid request identity");
 assertAgentEdits(args.edits);
 const fingerprint=JSON.stringify({documentId:args.documentId,generation:args.generation,baseVersion:args.baseVersion,edits:args.edits,contextSnapshotId:args.contextSnapshotId});
 const prior=await ctx.db.query("agentRequests").withIndex("by_grant_request",q=>q.eq("grantId",grant._id).eq("requestId",args.requestId)).unique();
 if(prior) {if(prior.fingerprint!==fingerprint)throw new Error("Request identity reused");return prior.result;}
 await requireDocument(ctx,`${args.documentId}:${args.generation}`,true,grant.userId);
 if(args.contextSnapshotId) {
  const context=await ctx.db.get(args.contextSnapshotId);
  if(!context || context.workspaceId!==grant.workspaceId || context.userId!==grant.userId || context.documentIds.some(id=>!grant.documentIds.includes(id)))throw new Error("Context outside grant");
 }
 const version=await ctx.runQuery(components.prosemirrorSync.lib.latestVersion,{id:document._id}); if(version===null)throw new Error("Document unavailable");
 if(version!==args.baseVersion) {const result={status:"conflict" as const,currentVersion:version};await ctx.db.insert("agentRequests",{grantId:grant._id,requestId:args.requestId,fingerprint,result});return result;}
 const scope=`${document._id}:${args.generation}`;
 const author=await ctx.db.insert("documentAuthors",{kind:"agent",grantId:grant._id,label:grant.label});
 const session=await ctx.db.insert("documentAuthorSessions",{author,scope,secretHash:await hashSecret(crypto.randomUUID())});
 const tr=new Transform((await materialize(ctx,document._id,version)).doc), mark=schema.marks.authorship.create({author});
 for(const edit of args.edits) {
  const rows=paragraphRows(tr.doc);
  if(edit.kind==="insert") {
   const previous=edit.afterParagraphId===null ? null : rows.find(p=>p.id===edit.afterParagraphId);
   if(edit.afterParagraphId!==null && !previous)throw new Error("Paragraph unavailable");
   tr.insert(previous?.to ?? 0,schema.node("paragraph",{paragraphId:crypto.randomUUID()},edit.text ? schema.text(edit.text,[mark]) : undefined));
  } else {
   const target=rows.find(p=>p.id===edit.paragraphId);if(!target)throw new Error("Paragraph unavailable");
   if(edit.kind==="delete") {
    if(rows.length===1)throw new Error("Keep at least one paragraph");
    tr.delete(target.from,target.to);
   } else tr.replaceWith(target.from+1,target.to-1,edit.text ? schema.text(edit.text,[mark]) : []);
  }
 }
 const originalParagraphs=new Set(paragraphRows(tr.before).map(p=>p.id));
 const createdParagraphIds=paragraphRows(tr.doc).filter(p=>!originalParagraphs.has(p.id)).map(p=>p.id);
 const createdStructures=paragraphRows(tr.doc).filter(p=>createdParagraphIds.includes(p.id)).map(p=>{const node=tr.doc.nodeAt(p.from)!;return {id:p.id,type:node.type.name,attrs:JSON.stringify(node.attrs)};});
 const steps=tr.steps.map(step=>new AuthoredStep(step,crypto.randomUUID()));
 if(!steps.length)throw new Error("Edit has no effect");
 await ctx.db.patch(document._id,{authorship:1});
 const result=await submitDocumentSteps(ctx,{id:scope,version,clientId:`agent:${grant._id}`,steps:steps.map(s=>JSON.stringify(s.toJSON())),protocol:1},{userId:grant.userId,author,session});
 if(result.status!=="synced")throw new Error("Unexpected document conflict");
 const operationGroupId=await ctx.db.insert("agentChanges",{workspaceId:grant.workspaceId,documentId:document._id,generation:args.generation,grantId:grant._id,userId:grant.userId,author,session,operations:steps.map(s=>s.id),createdParagraphIds,createdStructures,version:version+steps.length,undone:false});
 const accepted={status:"applied" as const,version:version+steps.length,operationGroupId};
 await ctx.db.insert("agentRequests",{grantId:grant._id,requestId:args.requestId,fingerprint,result:accepted});
 return accepted;
}
