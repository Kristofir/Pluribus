import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "core",
          environment: "node",
          include: ["core/**/*.{test,spec}.{ts,tsx,mts,cts,js,mjs,cjs}"],
        },
      },
      {
        test: {
          name: "backend",
          environment: "edge-runtime",
          include: ["convex/**/*.{test,spec}.{ts,tsx,mts,cts,js,mjs,cjs}"],
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
