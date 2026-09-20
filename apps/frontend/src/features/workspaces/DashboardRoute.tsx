import { useEffect, useState } from "react";
import { useMutation, useConvexAuth } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@pluribus/backend/api";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { DashboardPage } from "./DashboardPage";
import { AuthPanel } from "../auth/AuthPanel";
/** Claims only preassigned access; account creation itself never selects a workspace. */
export function DashboardRoute() {
 const auth = useConvexAuth(), claim = useMutation(api.Workspaces.claim), navigate = useNavigate();
 const result = useRetainedQuery(api.Workspaces.list, auth.isAuthenticated ? {} : "skip");
 const [failure,setFailure] = useState<string>();
 const retry = () => { setFailure(undefined); void claim({}).catch(()=>setFailure("Could not check preassigned access.")); };
 useEffect(()=>{ if(auth.isAuthenticated) void claim({}).catch(()=>setFailure("Could not check preassigned access.")); },[auth.isAuthenticated,claim]);
 return <DashboardPage workspaces={auth.isAuthenticated ? result.data ?? [] : []} loading={auth.isLoading || (auth.isAuthenticated && !result.data && !result.failed)} error={failure ?? (result.failed ? "Workspace listing unavailable." : undefined)} account={<div><AuthPanel /><button onClick={()=>void navigate({to:"/admin"})}>Read-only administration</button></div>} onRetry={retry} onOpen={w=>void navigate({to:"/workspaces/$workspaceId",params:{workspaceId:w.id}})} />;
}
