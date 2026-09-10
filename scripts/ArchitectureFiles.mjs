import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const testPath =
  /(^|\/)(__tests__|test-support)\/|\.(test|spec)\.[cm]?[jt]sx?$/;

export function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (
      entry.name === "node_modules" ||
      path === join("apps", "backend", "convex", "_generated")
    )
      return [];
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}
