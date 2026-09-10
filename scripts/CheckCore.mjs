import { fileURLToPath } from "node:url";
import ts from "typescript";
import { sourceFiles, testPath } from "./ArchitectureFiles.mjs";

const files = sourceFiles("packages/core").filter(
  (file) => !testPath.test(file),
);
if (!files.length) {
  console.log(
    "Core typecheck: no production core files yet; skipping empty compilation.",
  );
} else {
  const configPath = fileURLToPath(
    new URL("../tsconfig.core.json", import.meta.url),
  );
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(read.error.messageText, "\n"),
    );
  const converted = ts.convertCompilerOptionsFromJson(
    read.config.compilerOptions,
    process.cwd(),
  );
  const program = ts.createProgram(files, converted.options);
  const diagnostics = [
    ...converted.errors,
    ...ts.getPreEmitDiagnostics(program),
  ];
  if (diagnostics.length) {
    console.error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => "\n",
      }),
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Core typecheck: checked ${files.length} production files without browser or Node globals.`,
    );
  }
}
