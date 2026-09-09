import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const repository = fileURLToPath(new URL("../", import.meta.url));
const fixtures = [];

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "architecture-fixture-"));
  fixtures.push(root);
  symlinkSync(
    join(repository, "node_modules"),
    join(root, "node_modules"),
    "dir",
  );
  const contents = {
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        verbatimModuleSyntax: true,
        paths: { "@/*": ["./src/*"] },
      },
    }),
    "src/main.ts": "export const start = true;",
    ...files,
  };
  for (const [path, content] of Object.entries(contents)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

function run(script, root) {
  const result = spawnSync(
    process.execPath,
    [join(repository, "scripts", script)],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 15000,
    },
  );
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
}

afterEach(() => {
  for (const root of fixtures.splice(0))
    rmSync(root, { recursive: true, force: true });
});

test("valid adapters, client bindings, domain reuse and native reads pass", () => {
  const root = fixture({
    "core/item/domain/item.ts":
      "export type Item = { name: string }; export const valid = (name: string) => name.length > 0;",
    "core/item/application/save.ts":
      "import { valid } from '../domain/item'; export const save = valid;",
    "convex/item/save.ts":
      "export { save } from '../../core/item/application/save';",
    "convex/item/list.ts": "export const list = () => [];",
    "convex/_generated/api.js": "export const api = {};",
    "convex/_generated/api.d.ts":
      "import type { save } from '../item/save'; export declare const api: typeof save;",
    "convex/_generated/dataModel.d.ts": "export type Id = string;",
    "src/features/item/data.ts":
      "import { api } from '../../../convex/_generated/api'; import type { Id } from '../../../convex/_generated/dataModel'; export { valid } from '../../../core/item/domain/item'; export const client = api; export type Key = Id;",
  });
  expect(run("CheckArchitecture.mjs", root)).toMatchObject({ status: 0 });
  expect(run("CheckCore.mjs", root)).toMatchObject({ status: 0 });
});

test.each([
  [
    "core/item/domain/item.ts",
    "import { useState } from 'react'; export const hook = useState;",
    "core-has-no-external-dependencies",
  ],
  [
    "core/item/application/save.ts",
    "import type { Id } from '../../../convex/_generated/dataModel'; export type Key = Id;",
    "core-has-no-external-dependencies",
  ],
  [
    "core/item/domain/item.ts",
    "export { save } from '../application/save';",
    "domain-depends-only-on-domain",
  ],
  [
    "core/shared/types.ts",
    "export { save } from '../item/application/save';",
    "shared-core-does-not-depend-on-features",
  ],
  [
    "src/features/item/data.ts",
    "export { save } from '../../../core/item/application/save';",
    "frontend-does-not-run-application-use-cases",
  ],
  [
    "src/features/item/data.ts",
    "export { db } from '../../../convex/item/db';",
    "frontend-uses-client-bindings-only",
  ],
  [
    "src/features/item/data.ts",
    "export { query } from '../../../convex/_generated/server';",
    "frontend-uses-client-bindings-only",
  ],
  [
    "convex/item/unused.ts",
    "export { hidden } from '@/lib/hidden';",
    "backend-does-not-import-frontend",
  ],
  [
    "src/lib/hidden.ts",
    "export { value } from '../features/item/value';",
    "shared-ui-does-not-depend-on-features",
  ],
  [
    "src/features/item/data.ts",
    "export const load = () => import('../../../convex/item/db');",
    "frontend-uses-client-bindings-only",
  ],
  [
    "core/item/domain/unused.ts",
    "import { readFile } from 'node:fs'; export const read = readFile;",
    "core-has-no-external-dependencies",
  ],
  [
    "core/_generated/unused.ts",
    "export { db } from '../../convex/item/db';",
    "core-has-no-external-dependencies",
  ],
  [
    "src/features/item/unused.ts",
    "export { absent } from './missing';",
    "no-unresolved-imports",
  ],
])("rejects %s (%s)", (path, content, rule) => {
  const root = fixture({
    "core/item/application/save.ts": "export const save = () => true;",
    "convex/item/db.ts": "export const db = {};",
    "convex/_generated/server.js": "export const query = () => {};",
    "convex/_generated/dataModel.d.ts": "export type Id = string;",
    "src/lib/hidden.ts": "export const hidden = true;",
    "src/features/item/value.ts": "export const value = true;",
    [path]: content,
  });
  const result = run("CheckArchitecture.mjs", root);
  expect(result.status).toBe(1);
  expect(result.output).toContain(rule);
});

test("runtime cycles fail, including a cycle in otherwise unreachable files", () => {
  const root = fixture({
    "src/a.ts": "import { b } from './b'; export const a = () => b();",
    "src/b.ts": "import { a } from './a'; export const b = () => a();",
  });
  expect(run("CheckArchitecture.mjs", root)).toMatchObject({
    status: 1,
    output: expect.stringContaining("no-runtime-cycles"),
  });
});

test("recursive type dependencies do not count as runtime cycles", () => {
  const root = fixture({
    "core/item/domain/a.ts":
      "import type { B } from './b'; export type A = { b?: B }; export const value = 1;",
    "core/item/domain/b.ts":
      "import type { A } from './a'; import { value } from './a'; export type B = { a?: A }; export const runtime = value;",
  });
  expect(run("CheckArchitecture.mjs", root).status).toBe(0);
});

test("test tools are allowed but production cannot import a test helper", () => {
  const root = fixture({
    "core/item/domain/item.ts": "export const item = true;",
    "core/item/domain/item.test.ts":
      "import { expect } from 'vitest'; import { item } from './item'; expect(item).toBe(true);",
    "core/item/test-support/helper.ts": "export { useState } from 'react';",
  });
  expect(run("CheckArchitecture.mjs", root).status).toBe(0);
  expect(run("CheckCore.mjs", root).status).toBe(0);
  writeFileSync(
    join(root, "core/item/domain/item.ts"),
    "export { useState } from '../test-support/helper';",
  );
  expect(run("CheckArchitecture.mjs", root)).toMatchObject({
    status: 1,
    output: expect.stringContaining("production-does-not-import-tests"),
  });
});

test.each([
  "fetch('https://example.invalid')",
  "window.location",
  "process.env",
  "Buffer.from('x')",
])("isolated core compilation rejects %s", (expression) => {
  const root = fixture({
    "core/item/domain/item.ts": `export const value = ${expression};`,
  });
  expect(run("CheckCore.mjs", root)).toMatchObject({
    status: 1,
    output: expect.stringContaining("Cannot find name"),
  });
});

test("empty core is explicit while architecture checks still run", () => {
  const root = fixture({});
  expect(run("CheckCore.mjs", root)).toMatchObject({
    status: 0,
    output: expect.stringContaining("no production core files"),
  });
  expect(run("CheckArchitecture.mjs", root)).toMatchObject({
    status: 0,
    output: expect.stringContaining("checked 1 authored source files"),
  });
});

test("new core tests are automatically discovered and execute in Node", () => {
  const root = fixture({
    "core/item/domain/item.test.ts":
      "import { test, expect } from 'vitest'; test('node core', () => { expect(process.versions.node).toBeTruthy(); expect(typeof EdgeRuntime).toBe('undefined'); });",
  });
  const output = execFileSync(
    process.execPath,
    [
      join(repository, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      join(repository, "vitest.config.ts"),
      "--project",
      "core",
      "--root",
      root,
    ],
    { cwd: root, encoding: "utf8", timeout: 15000 },
  );
  expect(output).toContain("1 passed");
});
