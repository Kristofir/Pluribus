import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const backendFile = fileURLToPath(
  new URL("../apps/backend/.env.local", import.meta.url),
);
const frontendFile = fileURLToPath(
  new URL("../apps/frontend/.env.local", import.meta.url),
);
const backend = parseEnv(readFileSync(backendFile, "utf8"));
const value = backend.VITE_CONVEX_URL ?? backend.CONVEX_URL;
if (!value)
  throw new Error("Run backend setup before syncing the frontend URL.");
const url = new URL(value);
if (
  !["http:", "https:"].includes(url.protocol) ||
  url.username ||
  url.password
) {
  throw new Error("Expected a public HTTP(S) Convex deployment URL.");
}

const existing = existsSync(frontendFile)
  ? readFileSync(frontendFile, "utf8")
  : "";
const assignment = `VITE_CONVEX_URL=${value}`;
const contents = /^VITE_CONVEX_URL=.*$/m.test(existing)
  ? existing.replace(/^VITE_CONVEX_URL=.*$/m, assignment)
  : `${existing}${existing && !existing.endsWith("\n") ? "\n" : ""}${assignment}\n`;
writeFileSync(frontendFile, contents, { mode: 0o600 });
console.log(
  "Synced the public Convex URL to the frontend. No backend secrets copied.",
);
