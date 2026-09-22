import { useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { api } from "@pluribus/backend/api";

function readToken() {
  const token = window.location.hash.slice(1);
  return /^[0-9a-f-]{72}$/.test(token) ? token : "";
}

export default function ShareJoinRoute() {
  const [token] = useState(readToken);
  const auth = useConvexAuth();
  const { signIn } = useAuthActions();
  const redeem = useMutation(api.ShareLinks.redeem);
  const navigate = useNavigate();
  const signInStarted = useRef(false);
  const redeemStarted = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!token || auth.isLoading || error) return;
    if (!auth.isAuthenticated) {
      if (signInStarted.current) return;
      signInStarted.current = true;
      void signIn("anonymous")
        .then(({ signingIn }) => {
          if (!signingIn)
            setError(
              "Could not start a guest session. Reload this link to retry.",
            );
        })
        .catch(() =>
          setError(
            "Could not start a guest session. Reload this link to retry.",
          ),
        );
      return;
    }
    if (redeemStarted.current) return;
    redeemStarted.current = true;
    void redeem({ token })
      .then((workspaceId) =>
        navigate({
          to: "/workspaces/$workspaceId",
          params: { workspaceId },
          replace: true,
        }),
      )
      .catch(() => setError("This workspace link is unavailable or revoked."));
  }, [
    auth.isAuthenticated,
    auth.isLoading,
    error,
    navigate,
    redeem,
    signIn,
    token,
  ]);

  return (
    <main className="workspace-dashboard">
      <header className="workspace-page-heading">
        <div>
          <p className="workspace-eyebrow">Shared workspace</p>
          <h1>Joining workspace</h1>
        </div>
      </header>
      <p role={error || !token ? "alert" : "status"} className="my-4">
        {!token
          ? "This workspace link is invalid."
          : (error ?? "Opening the workspace as a collaborator…")}
      </p>
      {(error || !token) && (
        <Link to="/" search={{}}>
          Return to workspaces
        </Link>
      )}
    </main>
  );
}
