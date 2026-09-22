import { useEffect, useState } from "react";
import { useMutation, useConvexAuth } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@pluribus/backend/api";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { DashboardPage } from "./DashboardPage";
import { Button } from "@/components/ui/Button";
import { AuthPanel } from "../auth/AuthPanel";
/** Claims only preassigned access; account creation itself never selects a workspace. */
export function DashboardRoute() {
  const auth = useConvexAuth(),
    claim = useMutation(api.Workspaces.claim),
    navigate = useNavigate();
  const result = useRetainedQuery(
    api.Workspaces.list,
    auth.isAuthenticated ? {} : "skip",
  );
  const [failure, setFailure] = useState<string>();
  const retry = () => {
    setFailure(undefined);
    void claim({}).catch(() =>
      setFailure("Could not check preassigned access."),
    );
  };
  useEffect(() => {
    let active = true;
    setFailure(undefined);
    if (auth.isAuthenticated)
      void claim({}).catch(() => {
        if (active) setFailure("Could not check preassigned access.");
      });
    return () => {
      active = false;
    };
  }, [auth.isAuthenticated, claim]);
  return (
    <DashboardPage
      signedOut={!auth.isLoading && !auth.isAuthenticated}
      workspaces={auth.isAuthenticated ? (result.data ?? []) : []}
      loading={
        auth.isLoading ||
        (auth.isAuthenticated && !result.data && !result.failed)
      }
      error={
        auth.isAuthenticated
          ? (failure ??
            (result.failed ? "Workspace listing unavailable." : undefined))
          : undefined
      }
      account={
        <div className="flex flex-col items-start gap-3">
          <AuthPanel />
          {auth.isAuthenticated && (
            <Button
              intent="plain"
              size="sm"
              onPress={() => void navigate({ to: "/admin" })}
            >
              Read-only administration
            </Button>
          )}
        </div>
      }
      onRetry={retry}
      onOpen={(w) =>
        void navigate({
          to: "/workspaces/$workspaceId",
          params: { workspaceId: w.id },
        })
      }
    />
  );
}
