import { useState } from "react";
import type { Id } from "@pluribus/backend/dataModel";
import { Button } from "@/components/ui/Button";
import { SourcesPanel } from "../sources/SourcesPanel";
import { AgentAccessControls, type SelectedPassage } from "../agentAccess/AgentAccessControls";
import type { PassageReference } from "../agentAccess/AgentContextPanel";
export function WorkspaceTools({workspaceId,documentIds,selected,passages,onRemovePassage,onClose}:{workspaceId:Id<"workspaces">;documentIds:readonly Id<"documents">[];selected:string[];passages:SelectedPassage[];onRemovePassage:(p:PassageReference)=>void;onClose:()=>void}) {
 const [sourceIds,setSourceIds]=useState<string[]>([]),[excluded,setExcluded]=useState<string[]>([]);
 const elementIds=[...new Set([...selected,...sourceIds])].filter(id=>!excluded.includes(id));
 return <aside aria-label="Sources and agents" className="h-full overflow-auto"><header className="workspace-panel-heading"><h2 tabIndex={-1}>Sources & agents</h2><Button intent="plain" onPress={onClose}>Close ×</Button></header><div className="p-5 space-y-8"><SourcesPanel workspaceId={workspaceId} selected={sourceIds} onSelect={(id,included)=>{setSourceIds(ids=>included?[...new Set([...ids,id])]:ids.filter(value=>value!==id));setExcluded(ids=>ids.filter(value=>value!==id));}}/><AgentAccessControls workspaceId={workspaceId} documentIds={documentIds} selected={elementIds} passages={passages} onRemoveElement={id=>setExcluded(ids=>[...ids,id])} onRemovePassage={onRemovePassage}/></div></aside>;
}
