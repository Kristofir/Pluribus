import { useState, useCallback } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import CanvasPage from "../canvas/CanvasPage";
import { CollaborativeEditor } from "../documents/CollaborativeEditor";
import { DocumentRecoveryProvider } from "../documents/DocumentRecoveryProvider";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { MainDocumentPanel } from "./MainDocumentPanel";
const route = getRouteApi("/workspaces/$workspaceId");
export default function WorkspaceRoute() {
 const {workspaceId} = route.useParams(), auth = useConvexAuth();
 const current = useRetainedQuery(api.Users.current,{});
 if (auth.isLoading || (auth.isAuthenticated && !current.data)) return <p role="status">Loading account…</p>;
 if (!auth.isAuthenticated) return <p>Sign in from the dashboard to open a workspace.</p>;
 return <DocumentRecoveryProvider key={`${workspaceId}:${current.data?.id}`}><WorkspaceSession workspaceId={workspaceId as Id<"workspaces">} /></DocumentRecoveryProvider>;
}
function WorkspaceSession({workspaceId}:{workspaceId:Id<"workspaces">}) {
 const view = useRetainedQuery(api.Workspaces.open,{workspaceId}), navigate = useNavigate();
 const [panelOpen,setPanelOpen] = useState(true), [editing,setEditing] = useState(false);
 const [selection,setSelection] = useState<string[]>([]);
 const onSelection = useCallback((ids:string[])=>setSelection(ids),[]);
 if(view.failed) return <p role="alert">This workspace is unavailable or your access has changed. <button onClick={()=>void navigate({to:"/",search:{}})}>Return to dashboard</button></p>;
 if(!view.data) return <p role="status">Opening workspace…</p>;
 const w=view.data;
 return <WorkspaceLayout name={w.name} canvas={<CanvasPage workspaceId={workspaceId} onSelectionChange={onSelection}/>} panelOpen={panelOpen} onDashboard={()=>void navigate({to:"/",search:{}})} onMainDocument={()=>setPanelOpen(true)} onInbox={()=>setPanelOpen(true)} notice={selection.length ? `${selection.length} selected` : undefined} panel={<MainDocumentPanel title="Main document" kind="main" onClose={()=>{setPanelOpen(false);setEditing(false);}}><div onFocusCapture={()=>setEditing(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setEditing(false);}}><CollaborativeEditor key={`${w.mainDocumentId}:${w.mainGeneration}`} id={w.mainDocumentId} generation={w.mainGeneration} participate={panelOpen && editing} embedded /></div></MainDocumentPanel>} />;
}
