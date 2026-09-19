import { expect, test } from "vitest";
import {
  acceptAuthoredOperations,
  type AuthorshipEvidence,
  type OperationReceipt,
} from "./Authorship";

const actor = { author: "writer", session: "editor" };
const scope = "document:1";
function fixture(seed: [string, Partial<OperationReceipt<string>>][] = []) {
  const rows = new Map(
    seed.map(([id, value]) => [
      id,
      {
        ...actor,
        scope,
        consumed: false,
        version: 2,
        proof: "opaque inverse",
        ...value,
      },
    ]),
  );
  const evidence: AuthorshipEvidence<string> = {
    find: async (id) => rows.get(id) ?? null,
    consume: async (id) => {
      rows.get(id)!.consumed = true;
    },
    record: async (operation, receipt) => {
      rows.set(operation.id, receipt);
    },
  };
  const edits = {
    apply: async () => ({ proof: "verified inverse" }),
    assertComplete() {},
  };
  return { rows, evidence, edits };
}

test("acceptance retains writer, scope and canonical version; duplicate operations are rejected", async () => {
  const f = fixture();
  await acceptAuthoredOperations(f, actor, scope, 4, [{ id: "edit" }]);
  expect(f.rows.get("edit")).toEqual({
    ...actor,
    scope,
    consumed: false,
    version: 5,
    proof: "verified inverse",
  });
  await expect(
    acceptAuthoredOperations(f, actor, scope, 5, [{ id: "edit" }]),
  ).rejects.toThrow("already accepted");
});

test.each([
  { author: "another writer" },
  { session: "another editor" },
  { scope: "document:2" },
  { consumed: true },
])(
  "restoration rejects mismatched or consumed evidence: %j",
  async (mismatch) => {
    const f = fixture([["original", mismatch]]);
    await expect(
      acceptAuthoredOperations(f, actor, scope, 2, [
        { id: "undo", undoOf: "original" },
      ]),
    ).rejects.toThrow("not authorized");
    expect(f.rows.has("undo")).toBe(false);
  },
);

test("a failed protocol verification cannot consume restoration evidence", async () => {
  const f = fixture([["original", {}]]);
  f.edits.apply = async () => {
    throw new Error("Invalid inverse");
  };
  await expect(
    acceptAuthoredOperations(f, actor, scope, 2, [
      { id: "undo", undoOf: "original" },
    ]),
  ).rejects.toThrow("Invalid inverse");
  expect(f.rows.get("original")?.consumed).toBe(false);
  expect(f.rows.has("undo")).toBe(false);
});

test("move restoration requires both accepted halves and preserves their grouping for redo", async () => {
  const seed: [string, Partial<OperationReceipt<string>>][] = [
    ["remove", { move: { group: "move", part: "remove" } }],
    ["insert", { move: { group: "move", part: "insert" } }],
  ];
  const incomplete = fixture(seed);
  await expect(
    acceptAuthoredOperations(incomplete, actor, scope, 3, [
      { id: "undo-insert", undoOf: "insert" },
    ]),
  ).rejects.toThrow("complete move");
  // Transaction rollback is proved by Convex integration tests, not this in-memory port.
  const f = fixture(seed);
  await acceptAuthoredOperations(f, actor, scope, 3, [
    { id: "undo-insert", undoOf: "insert" },
    { id: "undo-remove", undoOf: "remove" },
  ]);
  expect(f.rows.get("undo-insert")?.move).toEqual(seed[1][1].move);
  expect(f.rows.get("undo-remove")?.move).toEqual(seed[0][1].move);
  expect(f.rows.get("insert")?.consumed).toBe(true);
  expect(f.rows.get("remove")?.consumed).toBe(true);
});
