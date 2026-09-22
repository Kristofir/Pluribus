import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { oauthAttemptPending } from "../auth/OAuthAttempt";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { DocumentLeaveGuard } from "../documents/DocumentLeaveGuard";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./LandingPage.css";

const CanvasPage = lazy(() => import("../canvas/CanvasPage"));

export function LandingPage({
  account,
  deferAnonymousSignIn = false,
}: {
  account: ReactNode;
  deferAnonymousSignIn?: boolean;
}) {
  const auth = useConvexAuth();
  const user = useQuery(api.Users.current, auth.isAuthenticated ? {} : "skip");
  const { signIn } = useAuthActions();
  const ensureDemo = useMutation(api.Workspaces.ensureLandingDemo);
  const signInStarted = useRef(false);
  const ensureStarted = useRef<string | null>(null);
  const [workspace, setWorkspace] = useState<{
    userId: string;
    id: Id<"workspaces">;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      auth.isLoading ||
      auth.isAuthenticated ||
      deferAnonymousSignIn ||
      oauthAttemptPending() ||
      signInStarted.current
    )
      return;
    signInStarted.current = true;
    void signIn("anonymous")
      .then(({ signingIn }) => {
        if (!signingIn) setError("Could not open the private canvas demo.");
      })
      .catch(() => setError("Could not open the private canvas demo."));
  }, [auth.isAuthenticated, auth.isLoading, deferAnonymousSignIn, signIn]);

  useEffect(() => {
    if (!user?.isAnonymous || ensureStarted.current === user.id) return;
    ensureStarted.current = user.id;
    void ensureDemo({})
      .then((id) => {
        try {
          localStorage.removeItem(`pluribus:viewport:landing:${id}`);
        } catch {
          // A saved view is optional; the canvas can still fit its seeded cards.
        }
        setWorkspace({ userId: user.id, id });
      })
      .catch(() => setError("Could not open the private canvas demo."));
  }, [ensureDemo, user]);

  const workspaceId =
    user?.isAnonymous && workspace?.userId === user.id ? workspace.id : null;
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-labelledby="landing-heading">
        <p className="landing-wordmark">pluribus</p>
        <h1 id="landing-heading">
          Pluribus is a shared canvas
          <span>for thinking together.</span>
        </h1>
        <div className="landing-account">{account}</div>
      </section>
      <figure className="landing-preview" aria-label="Private demo canvas">
        {workspaceId ? (
          <Suspense fallback={<p role="status">Opening your canvas…</p>}>
            <DocumentLeaveGuard.Provider value={false}>
              <CanvasPage
                key={workspaceId}
                embedded
                demo
                workspaceId={workspaceId}
                viewportStorageKey={`pluribus:viewport:landing:${workspaceId}`}
              />
            </DocumentLeaveGuard.Provider>
          </Suspense>
        ) : (
          <div
            className="landing-demo-loading"
            role={error ? "alert" : "status"}
          >
            {error ?? "Opening your private canvas…"}
          </div>
        )}
        <figcaption>
          <span>
            A real canvas for this anonymous guest. Your edits are private to
            this guest workspace.
          </span>{" "}
          <span className="landing-desktop-hint">
            Drag cards, edit the note, or right-click to add one. Image is a
            sample; uploads and page capture are unavailable in this demo.
          </span>
          <span className="landing-mobile-hint">
            Tap the note to edit. Image is a sample.
          </span>
        </figcaption>
      </figure>
    </main>
  );
}
