import { useEffect, useRef, useState } from "react";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@pluribus/backend/api";
import { Button } from "@/components/ui/Button";
import { forgetOAuthAttempt, rememberOAuthAttempt } from "./OAuthAttempt";

const homeRoute = getRouteApi("/");

export function AuthPanel({
  onOAuthCallbackFailure,
  onSignOut,
}: {
  onOAuthCallbackFailure?: () => void;
  onSignOut?: () => void;
} = {}) {
  const search = homeRoute.useSearch();
  const navigate = homeRoute.useNavigate();
  const router = useRouter();
  const { signIn, signOut } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.Users.current, isAuthenticated ? {} : "skip");
  const [callback] = useState(() => ({
    code: search.code,
    returned: search.authReturn,
  }));
  const [exchangingCode, setExchangingCode] = useState(Boolean(callback.code));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    callback.returned && !callback.code
      ? "Sign-in wasn’t completed. Please try again."
      : null,
  );
  const callbackStarted = useRef(false);

  useEffect(() => {
    if (callbackStarted.current) return;
    callbackStarted.current = true;
    if (!callback.code && !callback.returned) return;

    void navigate({
      search: (previous) => ({
        ...previous,
        code: undefined,
        authReturn: undefined,
      }),
      hash: true,
      replace: true,
    });

    // Handle the exchange here so expired codes show a recoverable error.
    // The ref prevents duplicate exchanges under React StrictMode.
    if (callback.code) {
      void signIn("google", { code: callback.code })
        .then(({ signingIn }) => {
          if (!signingIn) {
            setError("Sign-in wasn’t completed. Please try again.");
            forgetOAuthAttempt();
            onOAuthCallbackFailure?.();
          }
        })
        .catch(() => {
          setError("Couldn’t complete sign-in. Please try again.");
          forgetOAuthAttempt();
          onOAuthCallbackFailure?.();
        })
        .finally(() => setExchangingCode(false));
    }
  }, [callback, navigate, onOAuthCallbackFailure, signIn]);

  async function startSignIn() {
    setError(null);
    setPending(true);
    rememberOAuthAttempt();
    try {
      if (isAuthenticated && user?.isAnonymous) await signOut();
      const redirectTo = router.buildLocation({
        to: "/",
        search: { authReturn: true },
      }).href;
      const result = await signIn("google", { redirectTo });
      if (!result.redirect && !result.signingIn) {
        forgetOAuthAttempt();
        setError("Couldn’t start Google sign-in. Please try again.");
      }
    } catch {
      forgetOAuthAttempt();
      setError("Couldn’t start Google sign-in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function endSession() {
    setError(null);
    setPending(true);
    try {
      await signOut();
      forgetOAuthAttempt();
      onSignOut?.();
    } catch {
      setError("Couldn’t finish signing out. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label="Account" className="space-y-3">
      {isLoading || exchangingCode ? (
        <p role="status">
          {exchangingCode ? "Signing you in…" : "Checking your session…"}
        </p>
      ) : isAuthenticated && user === undefined ? (
        <p role="status">Loading your account…</p>
      ) : isAuthenticated && !user?.isAnonymous ? (
        <>
          <p role="status">
            {user === undefined
              ? "Loading your account…"
              : user === null
                ? "Your account is unavailable. Please sign out and try again."
                : `Signed in as ${user.name ?? user.email ?? "a Pluribus member"}.`}
          </p>
          <Button intent="secondary" isPending={pending} onPress={endSession}>
            {pending ? "Signing out…" : "Sign out"}
          </Button>
        </>
      ) : (
        <Button isPending={pending} onPress={startSignIn}>
          {pending ? "Opening Google…" : "Log in with Google"}
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
