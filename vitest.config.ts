import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    projects: [
      {
        test: {
          name: "frontend",
          environment: "node",
          include: ["apps/frontend/src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "core",
          environment: "node",
          include: [
            "packages/core/**/*.{test,spec}.{ts,tsx,mts,cts,js,mjs,cjs}",
          ],
        },
      },
      {
        test: {
          name: "backend",
          environment: "edge-runtime",
          include: [
            "apps/backend/convex/**/*.{test,spec}.{ts,tsx,mts,cts,js,mjs,cjs}",
          ],
        },
      },
      {
        test: {
          name: "architecture",
          environment: "node",
          include: ["scripts/**/*.test.mjs"],
        },
      },
    ],
  },
});
