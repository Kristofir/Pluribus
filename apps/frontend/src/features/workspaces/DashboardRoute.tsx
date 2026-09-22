import { useEffect, useState } from "react";
import { useMutation, useConvexAuth, useQuery } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { getRouteApi } from "@tanstack/react-router";
import { api } from "@pluribus/backend/api";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { DashboardPage } from "./DashboardPage";
import { Button } from "@/components/ui/Button";
import { AuthPanel } from "../auth/AuthPanel";
import { oauthAttemptPending } from "../auth/OAuthAttempt";
import { LandingPage } from "./LandingPage";

const homeRoute = getRouteApi("/");
/** Claims only preassigned access; account creation itself never selects a workspace. */
export function DashboardRoute() {
  const search = homeRoute.useSearch();
  const auth = useConvexAuth(),
    claim = useMutation(api.Workspaces.claim),
    navigate = useNavigate();
  const user = useQuery(api.Users.current, auth.isAuthenticated ? {} : "skip");
  const result = useRetainedQuery(
    api.Workspaces.list,
    auth.isAuthenticated ? {} : "skip",
  );
  const [failure, setFailure] = useState<string>();
  const [oauthCallbackPending, setOauthCallbackPending] = useState(() =>
    oauthAttemptPending(search.code, search.authReturn),
  );
  const retry = () => {
    setFailure(undefined);
    void claim({}).catch(() =>
      setFailure("Could not check preassigned access."),
    );
  };
  useEffect(() => {
    let active = true;
    setFailure(undefined);
    if (auth.isAuthenticated && user && !user.isAnonymous)
      void claim({}).catch(() => {
        if (active) setFailure("Could not check preassigned access.");
      });
    return () => {
      active = false;
    };
  }, [auth.isAuthenticated, claim, user]);
  if (!auth.isAuthenticated || user === undefined || user?.isAnonymous) {
    return (
      <LandingPage
        account={
          <AuthPanel
            onOAuthCallbackFailure={() => setOauthCallbackPending(false)}
            onSignOut={() => setOauthCallbackPending(false)}
          />
        }
        deferAnonymousSignIn={oauthCallbackPending}
      />
    );
  }
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
          <AuthPanel onSignOut={() => setOauthCallbackPending(false)} />
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
