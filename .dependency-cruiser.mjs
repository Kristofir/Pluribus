const source = "^(packages/core|apps/frontend/src|apps/backend/convex)/";
const generated = "^apps/backend/convex/_generated/";
const tests = "(^|/)(__tests__|test-support)/|\\.(test|spec)\\.[cm]?[jt]sx?$";
const production = { path: source, pathNot: `${generated}|${tests}` };

export const boundaryRules = [
  {
    name: "core-has-no-external-dependencies",
    severity: "error",
    from: { path: "^packages/core/", pathNot: tests },
    to: { pathNot: "^packages/core/" },
  },
  {
    name: "domain-depends-only-on-domain",
    severity: "error",
    from: { path: "^packages/core/[^/]+/domain/", pathNot: tests },
    to: { pathNot: "^packages/core/([^/]+/domain/|shared/)" },
  },
  {
    name: "shared-core-does-not-depend-on-features",
    severity: "error",
    from: { path: "^packages/core/shared/", pathNot: tests },
    to: { path: "^packages/core/", pathNot: "^packages/core/shared/" },
  },
  {
    name: "frontend-uses-client-bindings-only",
    severity: "error",
    from: { path: "^apps/frontend/src/", pathNot: tests },
    to: {
      path: "^apps/backend/",
      pathNot:
        "^apps/backend/convex/_generated/(api|dataModel)(\\.d)?\\.(js|ts)$",
    },
  },
  {
    name: "frontend-does-not-run-application-use-cases",
    severity: "error",
    from: { path: "^apps/frontend/src/", pathNot: tests },
    to: {
      path: "^packages/core/",
      pathNot: "^packages/core/([^/]+/domain/|shared/)",
    },
  },
  {
    name: "backend-does-not-import-frontend",
    severity: "error",
    from: { path: "^apps/backend/convex/", pathNot: `${generated}|${tests}` },
    to: { path: "^apps/frontend/" },
  },
  {
    name: "shared-ui-does-not-depend-on-features",
    severity: "error",
    from: {
      path: "^apps/frontend/src/(components|hooks|lib)/",
      pathNot: tests,
    },
    to: { path: "^apps/frontend/src/features/" },
  },
  {
    name: "production-does-not-import-tests",
    severity: "error",
    from: production,
    to: { path: tests },
  },
  {
    name: "no-unresolved-imports",
    severity: "error",
    from: { path: source, pathNot: generated },
    to: { couldNotResolve: true },
  },
];

export const runtimeRules = [
  {
    name: "no-runtime-cycles",
    severity: "error",
    from: production,
    to: { circular: true },
  },
];

export default {
  forbidden: boundaryRules,
  options: {
    doNotFollow: {
      path: "(^|/)node_modules/|^apps/backend/convex/_generated/",
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "types", "default"],
    },
  },
};
