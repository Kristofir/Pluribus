import { useConvexAuth } from "convex/react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@pluribus/backend/api";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { Button } from "@/components/ui/Button";
import { AdminPage } from "./AdminPage";
export default function AdminRoute() {
  const navigate = useNavigate(),
    auth = useConvexAuth();
  const [userCursor, setUsers] = useState<string | null>(null),
    [workspaceCursor, setWorkspaces] = useState<string | null>(null),
    [memberCursor, setMembers] = useState<string | null>(null);
  const users = useRetainedQuery(
      api.Workspaces.admin,
      auth.isAuthenticated
        ? {
            table: "users",
            paginationOpts: { numItems: 30, cursor: userCursor },
          }
        : "skip",
    ),
    workspaces = useRetainedQuery(
      api.Workspaces.admin,
      auth.isAuthenticated
        ? {
            table: "workspaces",
            paginationOpts: { numItems: 30, cursor: workspaceCursor },
          }
        : "skip",
    ),
    members = useRetainedQuery(
      api.Workspaces.admin,
      auth.isAuthenticated
        ? {
            table: "memberships",
            paginationOpts: { numItems: 30, cursor: memberCursor },
          }
        : "skip",
    );
  const failed = users.failed || workspaces.failed || members.failed;
  const denied = !auth.isLoading && !auth.isAuthenticated;
  return (
    <AdminPage
      access={
        auth.isLoading
          ? "loading"
          : denied
            ? "denied"
            : failed
              ? "allowed"
              : !users.data || !workspaces.data || !members.data
                ? "loading"
                : "allowed"
      }
      error={
        failed
          ? "Directory unavailable. Administrator access could not be verified. Return to the dashboard or reload to try again."
          : undefined
      }
      users={(users.data?.page ?? []).map((r) => ({ id: r.id, name: r.label }))}
      workspaces={(workspaces.data?.page ?? []).map((r) => ({
        id: r.id,
        name: r.label,
      }))}
      memberships={(members.data?.page ?? []).map((r) => ({
        id: r.id,
        userName:
          users.data?.page.find((user) => user.id === r.userId)?.label ??
          r.userId ??
          "Unknown user",
        workspaceName:
          workspaces.data?.page.find(
            (workspace) => workspace.id === r.workspaceId,
          )?.label ??
          r.workspaceId ??
          "Unknown workspace",
        role: r.label,
      }))}
      onBack={() => void navigate({ to: "/", search: {} })}
      pagination={
        <div className="flex gap-3 flex-wrap">
          {users.data && !users.data.isDone && (
            <Button
              intent="outline"
              size="sm"
              onPress={() => setUsers(users.data!.continueCursor)}
            >
              Next users
            </Button>
          )}
          {workspaces.data && !workspaces.data.isDone && (
            <Button
              intent="outline"
              size="sm"
              onPress={() => setWorkspaces(workspaces.data!.continueCursor)}
            >
              Next workspaces
            </Button>
          )}
          {members.data && !members.data.isDone && (
            <Button
              intent="outline"
              size="sm"
              onPress={() => setMembers(members.data!.continueCursor)}
            >
              Next memberships
            </Button>
          )}
          <Button
            intent="outline"
            size="sm"
            onPress={() => {
              setUsers(null);
              setWorkspaces(null);
              setMembers(null);
            }}
          >
            First pages
          </Button>
        </div>
      }
    />
  );
}
