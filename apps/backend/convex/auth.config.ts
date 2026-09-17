import type { AuthConfig } from "convex/server";

/**
 * JWT trust configuration consumed by Convex before authenticated functions run.
 * The local deployment's site URL is the issuer for Convex Auth sessions; the
 * application ID must match their audience. This validates identity, not feature access.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
