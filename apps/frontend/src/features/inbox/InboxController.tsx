import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { Button } from "@/components/ui/Button";
import { InboxPanel } from "./InboxPanel";
export function InboxController({workspaceId,onOpenDraft,onClose}:{workspaceId:Id<"workspaces">;onOpenDraft:(documentId:Id<"documents">,threadId:Id<"inboxThreads">,title:string)=>Promise<void>;onClose:()=>void}) {
 const inbox=useRetainedQuery(api.Inbox.list,{workspaceId}),refresh=useMutation(api.Inbox.refresh),draft=useMutation(api.Inbox.draft);
 const [selected,setSelected]=useState<string>(),[error,setError]=useState<string>(),[busy,setBusy]=useState(false);
 const unconfigured=inbox.data?.status==="unconfigured";
 return <InboxPanel threads={inbox.data?.threads??[]} selectedId={selected} loading={!inbox.data&&!inbox.failed} error={inbox.failed?"Inbox unavailable. Your open drafts remain mounted.":undefined} onSelect={setSelected} onClose={onClose} onOpenDraft={thread=>{if(busy)return;setBusy(true);setError(undefined);void draft({threadId:thread.id as Id<"inboxThreads">}).then(id=>onOpenDraft(id,thread.id as Id<"inboxThreads">,inbox.data?.threads.find(t=>t.id===thread.id)?.subject??"Reply")).catch(()=>setError("The reply draft could not open. Try again; existing drafts are retained.")).finally(()=>setBusy(false));}} integrationNotice={<div className="space-y-2">{unconfigured&&<p>No mailbox is assigned to this workspace. Email integration is unavailable.</p>}{inbox.data?.error&&<p role="alert">{inbox.data.error}</p>}{error&&<p role="alert">{error}</p>}{busy&&<p role="status">Opening draft…</p>}<Button intent="outline" size="sm" isDisabled={busy||inbox.failed||!inbox.data||unconfigured||inbox.data.status==="loading"} onPress={async()=>{setError(undefined);setBusy(true);try{await refresh({workspaceId});}catch{setError("Inbox refresh could not start. Check mailbox configuration and try again.");}finally{setBusy(false);}}}>{inbox.data?.status==="loading"?"Refreshing inbox…":"Refresh inbox"}</Button>{inbox.data?.threads.some(t=>t.truncated)&&<p>Some conversations are truncated. Review the original inbox before replying.</p>}</div>}/>
}
