import { cruise } from "dependency-cruiser";
import ts from "typescript";
import config, { runtimeRules } from "../.dependency-cruiser.mjs";
import { sourceFiles, testPath } from "./ArchitectureFiles.mjs";
import { publicApiViolations } from "./PublicApi.mjs";

const files = [
  "apps/frontend/src",
  "apps/backend/convex",
  "packages/core",
  "packages/editor",
].flatMap(sourceFiles);
const read = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
if (read.error)
  throw new Error(
    ts.flattenDiagnosticMessageText(read.error.messageText, "\n"),
  );
const parsed = ts.parseJsonConfigFileContent(
  read.config,
  ts.sys,
  process.cwd(),
);
if (parsed.errors.length)
  throw new Error(
    parsed.errors
      .map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
      .join("\n"),
  );

let errors = 0;
for (const runtimeOnly of [false, true]) {
  const result = await cruise(
    runtimeOnly ? files.filter((file) => !testPath.test(file)) : files,
    {
      ...config.options,
      validate: true,
      ruleSet: { forbidden: runtimeOnly ? runtimeRules : config.forbidden },
      tsPreCompilationDeps: !runtimeOnly,
      // Do not traverse test helpers when checking production runtime cycles.
      ...(runtimeOnly ? { exclude: { path: testPath.source } } : {}),
      outputType: "json",
    },
    {},
    { tsConfig: parsed },
  );
  const report = JSON.parse(result.output);
  for (const violation of report.summary.violations) {
    console.error(
      `${violation.rule.name}: ${violation.from} -> ${violation.to}`,
    );
    errors++;
  }
}
for (const violation of publicApiViolations(
  files.filter(
    (file) => file.startsWith("apps/backend/convex/") && !testPath.test(file),
  ),
  parsed.options,
)) {
  console.error(violation);
  errors++;
}
console.log(
  `Architecture: checked ${files.length} authored source files; ${errors} violations.`,
);
process.exitCode = errors ? 1 : 0;
