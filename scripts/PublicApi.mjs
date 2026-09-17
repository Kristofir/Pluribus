import ts from "typescript";

// Deliberately explicit: adding a client-callable feature is an API decision.
export const publicApiFiles = new Set([
  "apps/backend/convex/auth.ts",
  "apps/backend/convex/Canvas.ts",
  "apps/backend/convex/Presence.ts",
  "apps/backend/convex/Documents.ts",
  "apps/backend/convex/Health.ts",
  "apps/backend/convex/Users.ts",
]);

export function publicApiViolations(files, options) {
  const program = ts.createProgram(files, options);
  const checker = program.getTypeChecker();
  const violations = [];
  for (const file of files) {
    if (publicApiFiles.has(file)) continue;
    const source = program.getSourceFile(file);
    const module = source && checker.getSymbolAtLocation(source);
    if (!module) continue;
    for (const exported of checker.getExportsOfModule(module)) {
      const symbol =
        exported.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(exported)
          : exported;
      const type = checker.getTypeOfSymbolAtLocation(symbol, source);
      const members = type.isUnion() ? type.types : [type];
      if (
        members.some(
          (member) =>
            member.getProperty("isPublic") &&
            ["isQuery", "isMutation", "isAction"].some((key) =>
              member.getProperty(key),
            ),
        )
      ) {
        violations.push(
          `public-api-entrypoints-only: ${file} exports ${exported.name}`,
        );
      }
    }
  }
  return violations;
}
