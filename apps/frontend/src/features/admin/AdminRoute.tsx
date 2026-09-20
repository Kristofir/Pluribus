import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@pluribus/backend/api";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { AdminPage } from "./AdminPage";
export default function AdminRoute() {
 const navigate=useNavigate();const [userCursor,setUsers]=useState<string|null>(null),[workspaceCursor,setWorkspaces]=useState<string|null>(null),[memberCursor,setMembers]=useState<string|null>(null);
 const users=useRetainedQuery(api.Workspaces.admin,{table:"users",paginationOpts:{numItems:30,cursor:userCursor}}),workspaces=useRetainedQuery(api.Workspaces.admin,{table:"workspaces",paginationOpts:{numItems:30,cursor:workspaceCursor}}),members=useRetainedQuery(api.Workspaces.admin,{table:"memberships",paginationOpts:{numItems:30,cursor:memberCursor}});
 const denied=users.failed||workspaces.failed||members.failed;
 return <AdminPage access={denied?"denied":!users.data||!workspaces.data||!members.data?"loading":"allowed"} users={(users.data?.page??[]).map(r=>({id:r.id,name:r.label}))} workspaces={(workspaces.data?.page??[]).map(r=>({id:r.id,name:r.label}))} memberships={(members.data?.page??[]).map(r=>({id:r.id,userName:r.userId??"Unknown user",workspaceName:r.workspaceId??"Unknown workspace",role:r.label}))} onBack={()=>void navigate({to:"/",search:{}})} pagination={<div className="flex gap-3 flex-wrap">{users.data&&!users.data.isDone&&<button onClick={()=>setUsers(users.data!.continueCursor)}>Next users</button>}{workspaces.data&&!workspaces.data.isDone&&<button onClick={()=>setWorkspaces(workspaces.data!.continueCursor)}>Next workspaces</button>}{members.data&&!members.data.isDone&&<button onClick={()=>setMembers(members.data!.continueCursor)}>Next memberships</button>}<button onClick={()=>{setUsers(null);setWorkspaces(null);setMembers(null);}}>First pages</button></div>}/>;
}
