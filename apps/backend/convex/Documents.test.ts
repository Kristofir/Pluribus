/// <reference types="vite/client" />
import { documentSchema } from "@pluribus/editor/schema";
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { Step } from "@tiptap/pm/transform";
import {
  collab,
  sendableSteps,
  receiveTransaction,
  getVersion,
} from "prosemirror-collab";
import { history, undo } from "@tiptap/pm/history";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const editorSchema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "text*" },
    text: {},
  },
});
function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}
const insert = (text: string, from = 1) =>
  JSON.stringify({
    stepType: "replace",
    from,
    to: from,
    slice: { content: [{ type: "text", text }] },
  });

test("initialization is idempotent and binds one metadata record to one sync document", async () => {
  const t = setup();
  const ids = await Promise.all([
    t.mutation(api.Documents.ensureShared, {}),
    t.mutation(api.Documents.ensureShared, {}),
  ]);
  expect(ids[0]).toBe(ids[1]);
  expect(await t.query(api.Documents.latestVersion, { id: ids[0] })).toBe(1);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("documents")
        .withIndex("by_key", (q) => q.eq("key", "shared"))
        .take(2),
    ),
  ).toHaveLength(1);
});

test("step deltas rebase, snapshots cannot overwrite accepted content, and malformed writes roll back", async () => {
  const t = setup();
  const id = await t.mutation(api.Documents.ensureShared, {});
  await t.mutation(api.Documents.submitSteps, {
    id,
    version: 1,
    clientId: "a",
    steps: [insert("Hello")],
  });
  expect(
    await t.mutation(api.Documents.submitSteps, {
      id,
      version: 1,
      clientId: "b",
      steps: [insert("World")],
    }),
  ).toMatchObject({ status: "needs-rebase", clientIds: ["a"] });
  for (const args of [
    { version: 100, steps: [insert("gap")] },
    { version: 2, steps: [insert("outside", 999)] },
    { version: 2, steps: ["not json"] },
    { version: 2, steps: [] },
  ])
    await expect(
      t.mutation(api.Documents.submitSteps, { id, clientId: "a", ...args }),
    ).rejects.toThrow();
  await expect(
    t.mutation(api.Documents.submitSnapshot, {
      id,
      version: 2,
      content: JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph" }],
      }),
    }),
  ).rejects.toThrow("Snapshot does not match");
  expect(await t.query(api.Documents.latestVersion, { id })).toBe(2);
  const content = JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
    ],
  });
  await t.mutation(api.Documents.submitSnapshot, { id, version: 2, content });
  expect(await t.query(api.Documents.getSnapshot, { id })).toEqual({
    version: 2,
    content: JSON.stringify(documentSchema.nodeFromJSON(JSON.parse(content)).toJSON()),
  });
});

test("missing records and caller-supplied actors cannot bypass application access", async () => {
  const t = setup();
  const id = await t.mutation(api.Documents.ensureShared, {});
  await expect(
    // @ts-expect-error Deliberately test runtime rejection of an extra field.
    t.mutation(api.Documents.ensureShared, { actor: "admin" }),
  ).rejects.toThrow();
  await t.run((ctx) => ctx.db.delete("documents", id));
  await expect(t.query(api.Documents.getSnapshot, { id })).rejects.toThrow(
    "Document not found",
  );
  await expect(
    t.mutation(api.Documents.submitSteps, {
      id,
      version: 1,
      clientId: "a",
      steps: [insert("x")],
    }),
  ).rejects.toThrow("Document not found");
});

test.each(["separate paragraphs", "same sentence", "delete versus edit"])(
  "two clients converge with per-client undo: %s",
  async (scenario) => {
    const t = setup();
    const id = await t.mutation(api.Documents.ensureShared, {});
    const initial = editorSchema.node("doc", null, [
      editorSchema.node("paragraph", null, editorSchema.text("Hello world")),
      editorSchema.node(
        "paragraph",
        null,
        editorSchema.text("Second paragraph"),
      ),
    ]);
    const empty = EditorState.create({ schema: editorSchema });
    const seed = empty.tr.replaceWith(
      0,
      empty.doc.content.size,
      initial.content,
    );
    await t.mutation(api.Documents.submitSteps, {
      id,
      version: 1,
      clientId: "seed",
      steps: seed.steps.map((s) => JSON.stringify(s.toJSON())),
    });
    const version = 1 + seed.steps.length;
    let a = EditorState.create({
      doc: initial,
      plugins: [history(), collab({ version, clientID: "a" })],
    });
    let b = EditorState.create({
      doc: initial,
      plugins: [history(), collab({ version, clientID: "b" })],
    });
    a = a.apply(
      scenario === "delete versus edit"
        ? a.tr.delete(7, 12)
        : a.tr.insertText("A", 3),
    );
    b = b.apply(
      b.tr.insertText("B", scenario === "separate paragraphs" ? 17 : 9),
    );
    async function sync(state: EditorState) {
      for (let round = 0; round < 10; round++) {
        const pending = sendableSteps(state);
        if (!pending) break;
        const result = await t.mutation(api.Documents.submitSteps, {
          id,
          version: pending.version,
          clientId: pending.clientID,
          steps: pending.steps.map((s) => JSON.stringify(s.toJSON())),
        });
        state = state.apply(
          receiveTransaction(
            state,
            result.status === "synced"
              ? pending.steps
              : result.steps.map((s) =>
                  Step.fromJSON(editorSchema, JSON.parse(s)),
                ),
            result.status === "synced"
              ? pending.steps.map(() => pending.clientID)
              : result.clientIds,
          ),
        );
      }
      const remote = await t.query(api.Documents.getSteps, {
        id,
        version: getVersion(state),
      });
      return state.apply(
        receiveTransaction(
          state,
          remote.steps.map((s) => Step.fromJSON(editorSchema, JSON.parse(s))),
          remote.clientIds,
        ),
      );
    }
    a = await sync(a);
    b = await sync(b);
    a = await sync(a);
    expect(a.doc.eq(b.doc)).toBe(true);
    if (scenario !== "delete versus edit")
      expect(a.doc.textContent).toContain("B");
    else expect(a.doc.textContent).not.toContain("B");
    undo(a, (tr) => {
      a = a.apply(tr);
    });
    a = await sync(a);
    b = await sync(b);
    expect(a.doc.eq(b.doc)).toBe(true);
    if (scenario !== "delete versus edit")
      expect(a.doc.textContent).toContain("B");
    else expect(a.doc.textContent).not.toContain("B");
    if (scenario !== "delete versus edit")
      expect(a.doc.textContent).not.toContain("A");
    await t.mutation(api.Documents.submitSnapshot, {
      id,
      version: getVersion(a),
      content: JSON.stringify(a.doc.toJSON()),
    });
    const snapshot = await t.query(api.Documents.getSnapshot, { id });
    expect(
      snapshot.content &&
        editorSchema.nodeFromJSON(JSON.parse(snapshot.content)).eq(a.doc),
    ).toBe(true);
  },
);
