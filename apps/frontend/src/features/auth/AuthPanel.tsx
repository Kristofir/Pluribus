import { useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@pluribus/backend/api";
import { Button } from "@/components/ui/Button";

export function AuthPanel() {
  const { signIn, signOut } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.Users.current, isAuthenticated ? {} : "skip");
  const [callback] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return { code: params.get("code"), returned: params.has("authReturn") };
  });
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

    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("authReturn");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);

    // Handle the exchange here so expired codes show a recoverable error.
    // The ref prevents duplicate exchanges under React StrictMode.
    if (callback.code) {
      void signIn("google", { code: callback.code })
        .then(({ signingIn }) => {
          if (!signingIn)
            setError("Sign-in wasn’t completed. Please try again.");
        })
        .catch(() => setError("Couldn’t complete sign-in. Please try again."))
        .finally(() => setExchangingCode(false));
    }
  }, [callback, signIn]);

  async function startSignIn() {
    setError(null);
    setPending(true);
    try {
      const result = await signIn("google", { redirectTo: "/?authReturn=1" });
      if (!result.redirect && !result.signingIn) {
        setError("Couldn’t start Google sign-in. Please try again.");
      }
    } catch {
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
      ) : isAuthenticated ? (
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
          {pending ? "Opening Google…" : "Sign in with Google"}
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
