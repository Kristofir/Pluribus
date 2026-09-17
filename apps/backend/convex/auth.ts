import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Integrates Google sign-in and Convex Auth sessions. Exposes auth operations
 * and HTTP setup; feature access remains the responsibility of core policy.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
});
