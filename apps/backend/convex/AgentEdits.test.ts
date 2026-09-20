/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test } from "vitest";
import { Transform } from "@tiptap/pm/transform";
import { AuthoredStep } from "@pluribus/editor/protocol";
import { documentSchema as ds } from "@pluribus/editor/schema";
import { materialize } from "./documents/Sync";
import schema from "./schema";
import { api, internal } from "./_generated/api";
const modules=import.meta.glob("./**/*.ts");
const uuid=()=>crypto.randomUUID();
async function setup() {
 const t=convexTest(schema,modules);register(t);
 const user=await t.run(ctx=>ctx.db.insert("users",{})),other=await t.run(ctx=>ctx.db.insert("users",{}));
 const workspaceId=await t.mutation(internal.workspaces.Provisioning.provision,{slug:"agents",name:"Agents",assignments:[]});
 await t.run(async ctx=>{await ctx.db.insert("workspaceMembers",{workspaceId,userId:user});await ctx.db.insert("workspaceMembers",{workspaceId,userId:other});});
 const a=t.withIdentity({subject:user}),b=t.withIdentity({subject:other});
 const panel=await a.query(api.Workspaces.open,{workspaceId});
 const grant=await a.mutation(api.AgentAccess.grant,{workspaceId,documentIds:[panel.mainDocumentId],label:"Review agent"});
 const read=()=>t.query(internal.agentAccess.Tools.readDocument,{token:grant.token,documentId:panel.mainDocumentId});
 return {t,a,b,workspaceId,id:panel.mainDocumentId,grant,read};
}
test("agent request replay is immutable, stale version conflicts, revoked grants cannot read",async()=>{
 const {t,a,id,grant,read}=await setup(),initial=await read();
 const request={token:grant.token,requestId:uuid(),documentId:id,generation:1,baseVersion:1,edits:[{kind:"replace" as const,paragraphId:initial.paragraphs[0].paragraphId,text:"Agent text"}]};
 const accepted=await t.mutation(internal.agentAccess.Tools.applyEdit,request);expect(accepted.status).toBe("applied");
 expect(await t.mutation(internal.agentAccess.Tools.applyEdit,request)).toEqual(accepted);
 expect(await t.mutation(internal.agentAccess.Tools.applyEdit,{...request,requestId:uuid()})).toMatchObject({status:"conflict"});
 await expect(t.mutation(internal.agentAccess.Tools.applyEdit,{...request,edits:[{...request.edits[0],text:"Changed request"}]})).rejects.toThrow("reused");
 await a.mutation(api.AgentAccess.revoke,{grantId:grant.grantId});await expect(read()).rejects.toThrow("access denied");
});
test("delegated complete-group undo preserves later human text elsewhere, refuses another initiating user",async()=>{
 const {t,a,b,id,grant,read}=await setup(),initial=await read();
 const accepted=await t.mutation(internal.agentAccess.Tools.applyEdit,{token:grant.token,requestId:uuid(),documentId:id,generation:1,baseVersion:1,edits:[{kind:"replace",paragraphId:initial.paragraphs[0].paragraphId,text:"Agent text"},{kind:"insert",afterParagraphId:null,text:"Agent heading"}]});
 if(accepted.status!=="applied")throw new Error("Expected apply");
 const human=await b.mutation(api.Documents.openAuthorship,{id:`${id}:1`});
 const current=ds.nodeFromJSON(await t.run(async ctx=>(await materialize(ctx,id,accepted.version)).doc.toJSON()));
 const paragraph=ds.node("paragraph",{paragraphId:uuid()},ds.text("Human addition",[ds.marks.authorship.create({author:human.author})]));
 const tr=new Transform(current).insert(current.content.size,paragraph);
 await b.mutation(api.Documents.submitSteps,{id:`${id}:1`,version:accepted.version,clientId:"human",credential:human.credential,protocol:1,steps:tr.steps.map(s=>JSON.stringify(new AuthoredStep(s,uuid()).toJSON()))});
 await expect(b.mutation(api.AgentAccess.undo,{changeId:accepted.operationGroupId,requestId:uuid()})).rejects.toThrow("another user");
 const undo={changeId:accepted.operationGroupId,requestId:uuid()};const result=await a.mutation(api.AgentAccess.undo,undo);
 expect(await a.mutation(api.AgentAccess.undo,undo)).toEqual(result);
 expect((await read()).paragraphs.map(p=>p.text)).toEqual(["","Human addition"]);
});
test("undo refuses to erase human text inserted inside an agent paragraph and rolls back all evidence",async()=>{
 const {t,a,b,id,grant,read}=await setup(),initial=await read();
 const accepted=await t.mutation(internal.agentAccess.Tools.applyEdit,{token:grant.token,requestId:uuid(),documentId:id,generation:1,baseVersion:1,edits:[{kind:"replace",paragraphId:initial.paragraphs[0].paragraphId,text:"AB"}]});
 if(accepted.status!=="applied")throw new Error("Expected apply");
 const human=await b.mutation(api.Documents.openAuthorship,{id:`${id}:1`});
 const current=ds.nodeFromJSON(await t.run(async ctx=>(await materialize(ctx,id,accepted.version)).doc.toJSON()));
 const tr=new Transform(current).insert(2,ds.text("human",[ds.marks.authorship.create({author:human.author})]));
 await b.mutation(api.Documents.submitSteps,{id:`${id}:1`,version:accepted.version,clientId:"human",credential:human.credential,protocol:1,steps:tr.steps.map(s=>JSON.stringify(new AuthoredStep(s,uuid()).toJSON()))});
 const before=await read();await expect(a.mutation(api.AgentAccess.undo,{changeId:accepted.operationGroupId,requestId:uuid()})).rejects.toThrow("another writer");
 expect(await read()).toEqual(before);expect((await a.query(api.AgentAccess.changes,{workspaceId:(await t.run(ctx=>ctx.db.get(accepted.operationGroupId)))!.workspaceId}))[0].undone).toBe(false);
});
test("paragraph links stay unresolved after deletion and replacement text, then resolve on verified Undo",async()=>{
 const {t,a,id,grant,read,workspaceId}=await setup();const initial=await read(),anchor=initial.paragraphs[0].paragraphId;
 await t.mutation(internal.agentAccess.Tools.applyEdit,{token:grant.token,requestId:uuid(),documentId:id,generation:1,baseVersion:initial.version,edits:[{kind:"replace",paragraphId:anchor,text:"Linked paragraph"},{kind:"insert",afterParagraphId:anchor,text:"Keep"}]});
 const rectangle=await a.mutation(api.Canvas.create,{workspaceId,geometry:{x:0,y:0,width:100,height:100},color:"blue"});const before=await read();
 await a.mutation(api.Documents.linkParagraph,{workspaceId,elementId:rectangle,documentId:id,paragraphId:anchor,version:before.version});
 const deleted=await t.mutation(internal.agentAccess.Tools.applyEdit,{token:grant.token,requestId:uuid(),documentId:id,generation:1,baseVersion:before.version,edits:[{kind:"delete",paragraphId:anchor}]});if(deleted.status!=="applied")throw new Error("Expected deletion");
 expect(await a.query(api.Documents.resolveParagraph,{documentId:id,paragraphId:anchor})).toBeNull();
 await t.mutation(internal.agentAccess.Tools.applyEdit,{token:grant.token,requestId:uuid(),documentId:id,generation:1,baseVersion:deleted.version,edits:[{kind:"insert",afterParagraphId:null,text:"Linked paragraph"}]});
 expect(await a.query(api.Documents.resolveParagraph,{documentId:id,paragraphId:anchor})).toBeNull();
 await a.mutation(api.AgentAccess.undo,{changeId:deleted.operationGroupId,requestId:uuid()});
 expect(await a.query(api.Documents.resolveParagraph,{documentId:id,paragraphId:anchor})).toMatchObject({text:"Linked paragraph"});
 expect((await a.query(api.Documents.links,{workspaceId}))[0].paragraphId).toBe(anchor);
});
test("delegated undo refuses a human line break inside agent text",async()=>{
 const {t,a,b,id,grant,read}=await setup(),initial=await read();
 const accepted=await t.mutation(internal.agentAccess.Tools.applyEdit,{token:grant.token,requestId:uuid(),documentId:id,generation:1,baseVersion:1,edits:[{kind:"replace",paragraphId:initial.paragraphs[0].paragraphId,text:"AB"}]});if(accepted.status!=="applied")throw new Error("Expected apply");
 const human=await b.mutation(api.Documents.openAuthorship,{id:`${id}:1`});
 const current=ds.nodeFromJSON(await t.run(async ctx=>(await materialize(ctx,id,accepted.version)).doc.toJSON()));const tr=new Transform(current).insert(2,ds.node("hardBreak"));
 await b.mutation(api.Documents.submitSteps,{id:`${id}:1`,version:accepted.version,clientId:"human",credential:human.credential,protocol:1,steps:tr.steps.map(s=>JSON.stringify(new AuthoredStep(s,uuid()).toJSON()))});
 const before=await a.query(api.Documents.latestVersion,{id:`${id}:1`});
 await expect(a.mutation(api.AgentAccess.undo,{changeId:accepted.operationGroupId,requestId:uuid()})).rejects.toThrow("structural edit");
 expect(await a.query(api.Documents.latestVersion,{id:`${id}:1`})).toBe(before);
});
test("accepted agent retry retains its outcome after a card delete/restore generation advance",async()=>{
 const {t,a,workspaceId}=await setup();const child=await a.mutation(api.Canvas.createDocument,{workspaceId,geometry:{x:0,y:0,width:430,height:500}});
 const card=(await a.query(api.Canvas.documentCards,{workspaceId}))[0],grant=await a.mutation(api.AgentAccess.grant,{workspaceId,documentIds:[card.documentId],label:"Agent"});
 const initial=await t.query(internal.agentAccess.Tools.readDocument,{token:grant.token,documentId:card.documentId});
 const request={token:grant.token,requestId:uuid(),documentId:card.documentId,generation:1,baseVersion:1,edits:[{kind:"replace" as const,paragraphId:initial.paragraphs[0].paragraphId,text:"Saved"}]};const result=await t.mutation(internal.agentAccess.Tools.applyEdit,request);
 const secret=uuid(),session=await a.mutation(api.Canvas.openHistorySession,{workspaceId,secret,nonce:uuid()}),action=uuid();const deleted=await a.mutation(api.Canvas.applyHistoryAction,{session,secret,action,attempt:uuid(),input:{kind:"delete",id:child,generation:1}});
 await a.mutation(api.Canvas.reverseHistoryAction,{session,secret,action,attempt:uuid(),revision:deleted.revision,undo:true});
 expect(await t.mutation(internal.agentAccess.Tools.applyEdit,request)).toEqual(result);
 await expect(t.mutation(internal.agentAccess.Tools.applyEdit,{...request,requestId:uuid()})).rejects.toThrow("expired");
});
test("agent paragraph Undo rejects a later human heading transformation",async()=>{
 const {t,a,b,id,grant,read}=await setup(),initial=await read();
 const accepted=await t.mutation(internal.agentAccess.Tools.applyEdit,{token:grant.token,requestId:uuid(),documentId:id,generation:1,baseVersion:1,edits:[{kind:"insert",afterParagraphId:initial.paragraphs[0].paragraphId,text:"AB"}]});if(accepted.status!=="applied")throw new Error("Expected apply");
 const human=await b.mutation(api.Documents.openAuthorship,{id:`${id}:1`});const current=ds.nodeFromJSON(await t.run(async ctx=>(await materialize(ctx,id,accepted.version)).doc.toJSON()));
 const paragraph=current.child(1);const tr=new Transform(current).setNodeMarkup(current.child(0).nodeSize,ds.nodes.heading,{...paragraph.attrs,level:2});
 await b.mutation(api.Documents.submitSteps,{id:`${id}:1`,version:accepted.version,clientId:"human",credential:human.credential,protocol:1,steps:tr.steps.map(s=>JSON.stringify(new AuthoredStep(s,uuid()).toJSON()))});
 const before=await a.query(api.Documents.latestVersion,{id:`${id}:1`});await expect(a.mutation(api.AgentAccess.undo,{changeId:accepted.operationGroupId,requestId:uuid()})).rejects.toThrow("structural edit");expect(await a.query(api.Documents.latestVersion,{id:`${id}:1`})).toBe(before);
});
