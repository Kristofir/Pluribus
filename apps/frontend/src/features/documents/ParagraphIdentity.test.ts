import { expect, test } from "vitest";
import { EditorState } from "@tiptap/pm/state";
import { Fragment, Slice } from "@tiptap/pm/model";
import { documentSchema as schema } from "@pluribus/editor/schema";
import {
  assertParagraphIds,
  freshParagraphSlice,
  paragraphRows,
  prepareParagraphIds,
} from "@pluribus/editor/paragraphs";
const p = (id: string, text = "text") =>
  schema.node(
    "paragraph",
    { paragraphId: id },
    text ? schema.text(text) : undefined,
  );
const state = () =>
  EditorState.create({
    schema,
    doc: schema.node("doc", null, [p("first", "hello"), p("second", "world")]),
  });
test("split keeps original first; merge keeps first and removes second identity", () => {
  const original = state(),
    tr = original.tr.split(3);
  prepareParagraphIds(tr, () => "split");
  expect(paragraphRows(tr.doc).map((p) => p.id)).toEqual([
    "first",
    "split",
    "second",
  ]);
  const merged = EditorState.create({ schema, doc: tr.doc }).tr.join(4);
  prepareParagraphIds(merged, () => "unused");
  expect(paragraphRows(merged.doc).map((p) => p.id)).toEqual([
    "first",
    "second",
  ]);
  assertParagraphIds(merged.doc);
});
test("paste strips foreign IDs and insertion before an original cannot steal its anchor", () => {
  const pasted = freshParagraphSlice(
    new Slice(Fragment.from(p("first")), 0, 0),
  );
  const tr = state().tr.replaceRange(0, 0, pasted);
  prepareParagraphIds(tr, () => "paste");
  expect(paragraphRows(tr.doc).map((p) => p.id)).toEqual([
    "paste",
    "first",
    "second",
  ]);
  const duplicate = state().tr.insert(0, p("first"));
  prepareParagraphIds(duplicate, () => "duplicate");
  expect(paragraphRows(duplicate.doc).map((p) => p.id)).toEqual([
    "duplicate",
    "first",
    "second",
  ]);
});
test("explicit full-paragraph move and its inverse retain identity; duplicate canonical IDs reject", () => {
  const original = state(),
    slice = original.doc.slice(0, 7),
    tr = original.tr.delete(0, 7).insert(7, slice.content);
  prepareParagraphIds(tr, () => "unused");
  expect(paragraphRows(tr.doc).map((p) => p.id)).toEqual(["second", "first"]);
  let restored = tr.doc;
  for (let i = tr.steps.length - 1; i >= 0; i--)
    restored = tr.steps[i].invert(tr.docs[i]).apply(restored).doc!;
  expect(restored.eq(original.doc)).toBe(true);
  expect(() =>
    assertParagraphIds(schema.node("doc", null, [p("same"), p("same")])),
  ).toThrow("duplicate");
});

test("concurrent splits rebase to unique stable IDs across both collaborators", async () => {
  const { collab, sendableSteps, receiveTransaction } =
    await import("prosemirror-collab");
  const initial = schema.node("doc", null, [p("original", "hello")]);
  let a = EditorState.create({
      schema,
      doc: initial,
      plugins: [collab({ version: 1, clientID: "a" })],
    }),
    b = EditorState.create({
      schema,
      doc: initial,
      plugins: [collab({ version: 1, clientID: "b" })],
    });
  const ta = a.tr.split(3);
  prepareParagraphIds(ta, () => "split-a");
  a = a.apply(ta);
  const tb = b.tr.split(4);
  prepareParagraphIds(tb, () => "split-b");
  b = b.apply(tb);
  const sa = sendableSteps(a)!;
  let canonical = initial;
  for (const step of sa.steps) canonical = step.apply(canonical).doc!;
  assertParagraphIds(canonical);
  a = a.apply(
    receiveTransaction(
      a,
      sa.steps,
      sa.steps.map(() => "a"),
    ),
  );
  b = b.apply(
    receiveTransaction(
      b,
      sa.steps,
      sa.steps.map(() => "a"),
    ),
  );
  const sb = sendableSteps(b)!;
  for (const step of sb.steps) canonical = step.apply(canonical).doc!;
  assertParagraphIds(canonical);
  a = a.apply(
    receiveTransaction(
      a,
      sb.steps,
      sb.steps.map(() => "b"),
    ),
  );
  b = b.apply(
    receiveTransaction(
      b,
      sb.steps,
      sb.steps.map(() => "b"),
    ),
  );
  expect(a.doc.eq(b.doc)).toBe(true);
  expect(a.doc.eq(canonical)).toBe(true);
  expect(paragraphRows(canonical).map((p) => p.id)).toEqual([
    "original",
    "split-a",
    "split-b",
  ]);
});
test("native editor Undo and Redo restore the canonical paragraph IDs", async () => {
  const { history, undo, redo } = await import("@tiptap/pm/history");
  const { attributeTransaction } = await import("./AuthorshipExtension");
  let s = EditorState.create({
    schema,
    doc: schema.node("doc", null, [p("original", "hello")]),
    plugins: [history()],
  });
  const tr = s.tr.split(3);
  prepareParagraphIds(tr, () => "new");
  attributeTransaction(tr, s, "author");
  s = s.apply(tr);
  const split = s.doc;
  expect(
    undo(s, (tr) => {
      prepareParagraphIds(tr, () => "wrong");
      attributeTransaction(tr, s, "author");
      s = s.apply(tr);
    }),
  ).toBe(true);
  expect(paragraphRows(s.doc).map((p) => p.id)).toEqual(["original"]);
  expect(
    redo(s, (tr) => {
      prepareParagraphIds(tr, () => "wrong");
      attributeTransaction(tr, s, "author");
      s = s.apply(tr);
    }),
  ).toBe(true);
  expect(s.doc.eq(split)).toBe(true);
});

test("concurrent deletion and replacement paste never transfers the deleted paragraph anchor", async () => {
  const { collab, sendableSteps, receiveTransaction } =
    await import("prosemirror-collab");
  const initial = schema.node("doc", null, [
    p("linked", "same"),
    p("keep", "other"),
  ]);
  let a = EditorState.create({
      schema,
      doc: initial,
      plugins: [collab({ version: 1, clientID: "a" })],
    }),
    b = EditorState.create({
      schema,
      doc: initial,
      plugins: [collab({ version: 1, clientID: "b" })],
    });
  const deletion = a.tr.delete(0, initial.firstChild!.nodeSize);
  prepareParagraphIds(deletion, () => "unused");
  a = a.apply(deletion);
  const pasted = freshParagraphSlice(
    new Slice(Fragment.from(p("linked", "same")), 0, 0),
  );
  const replacement = b.tr.replaceRange(
    initial.content.size,
    initial.content.size,
    pasted,
  );
  prepareParagraphIds(replacement, () => "replacement");
  b = b.apply(replacement);
  const deleted = sendableSteps(a)!;
  a = a.apply(
    receiveTransaction(
      a,
      deleted.steps,
      deleted.steps.map(() => "a"),
    ),
  );
  b = b.apply(
    receiveTransaction(
      b,
      deleted.steps,
      deleted.steps.map(() => "a"),
    ),
  );
  const inserted = sendableSteps(b)!;
  a = a.apply(
    receiveTransaction(
      a,
      inserted.steps,
      inserted.steps.map(() => "b"),
    ),
  );
  b = b.apply(
    receiveTransaction(
      b,
      inserted.steps,
      inserted.steps.map(() => "b"),
    ),
  );
  expect(a.doc.eq(b.doc)).toBe(true);
  assertParagraphIds(a.doc);
  const rows = paragraphRows(a.doc);
  expect(rows.map((r) => r.id)).toEqual(["keep", "replacement"]);
  expect(rows.find((r) => r.id === "linked")).toBeUndefined();
  expect(rows.find((r) => r.id === "replacement")?.text).toBe("same");
});

test("concurrent merge and text edit preserve the surviving first paragraph identity", async () => {
  const { collab, sendableSteps, receiveTransaction } =
    await import("prosemirror-collab");
  const initial = schema.node("doc", null, [
    p("first", "hello"),
    p("second", "world"),
  ]);
  let a = EditorState.create({
      schema,
      doc: initial,
      plugins: [collab({ version: 1, clientID: "a" })],
    }),
    b = EditorState.create({
      schema,
      doc: initial,
      plugins: [collab({ version: 1, clientID: "b" })],
    });
  const merge = a.tr.join(initial.firstChild!.nodeSize);
  prepareParagraphIds(merge, () => "unused");
  a = a.apply(merge);
  const edit = b.tr.insertText("!", initial.content.size - 1);
  prepareParagraphIds(edit, () => "unused");
  b = b.apply(edit);
  const merged = sendableSteps(a)!;
  a = a.apply(
    receiveTransaction(
      a,
      merged.steps,
      merged.steps.map(() => "a"),
    ),
  );
  b = b.apply(
    receiveTransaction(
      b,
      merged.steps,
      merged.steps.map(() => "a"),
    ),
  );
  const edited = sendableSteps(b)!;
  a = a.apply(
    receiveTransaction(
      a,
      edited.steps,
      edited.steps.map(() => "b"),
    ),
  );
  b = b.apply(
    receiveTransaction(
      b,
      edited.steps,
      edited.steps.map(() => "b"),
    ),
  );
  expect(a.doc.eq(b.doc)).toBe(true);
  assertParagraphIds(a.doc);
  expect(paragraphRows(a.doc).map((r) => ({ id: r.id, text: r.text }))).toEqual(
    [{ id: "first", text: "helloworld!" }],
  );
});
