import { expect, test } from "vitest";
import { EditorState } from "@tiptap/pm/state";
import { history, undo, redo } from "@tiptap/pm/history";
import { Transform } from "@tiptap/pm/transform";
import { documentSchema } from "@pluribus/editor/schema";
import { AuthoredStep } from "@pluribus/editor/protocol";
import {
  attributeTransaction,
  authorDisplayDecorations,
  authorHue,
  authorTextClass,
} from "./AuthorshipExtension";
const attributed = documentSchema.text("Other", [
  documentSchema.marks.authorship.create({ author: "alice" }),
]);
function initial() {
  return EditorState.create({
    doc: documentSchema.node("doc", null, [
      documentSchema.node("paragraph", null, attributed),
    ]),
    plugins: [history()],
  });
}
function authors(state: EditorState) {
  const values: { text: string; author: string }[] = [];
  state.doc.descendants((node) => {
    if (node.isText)
      values.push({
        text: node.text!,
        author: node.marks.find((m) => m.type.name === "authorship")?.attrs
          .author,
      });
  });
  return values;
}
test("typing overrides inherited attribution, paste assigns the writer, and native undo/redo preserve provenance", () => {
  let state = initial();
  const tr = state.tr.insertText("!", 3);
  attributeTransaction(tr, state, "bob");
  state = state.apply(tr);
  expect(authors(state)).toEqual([
    { text: "Ot", author: "alice" },
    { text: "!", author: "bob" },
    { text: "her", author: "alice" },
  ]);
  expect(tr.steps.every((step) => step instanceof AuthoredStep)).toBe(true);
  undo(state, (tr) => {
    attributeTransaction(tr, state, "bob");
    expect((tr.steps[0] as AuthoredStep).undoOf).toBeTruthy();
    state = state.apply(tr);
  });
  expect(state.doc.textContent).toBe("Other");
  redo(state, (tr) => {
    attributeTransaction(tr, state, "bob");
    state = state.apply(tr);
  });
  expect(authors(state)[1].author).toBe("bob");
  const paste = state.tr.replaceWith(1, 1, attributed);
  attributeTransaction(paste, state, "bob");
  state = state.apply(paste);
  expect(authors(state)[0]).toEqual({ text: "Other", author: "bob" });
});
test("formatting preserves attribution and authored inversion preserves ordinary map behavior", () => {
  let state = initial();
  const tr = state.tr.addMark(1, 6, documentSchema.marks.bold.create());
  attributeTransaction(tr, state, "bob");
  state = state.apply(tr);
  expect(authors(state)).toEqual([{ text: "Other", author: "alice" }]);
  const inverse = tr.steps[0].invert(tr.before);
  expect(inverse instanceof AuthoredStep).toBe(true);
  const mapped = inverse.map(
    new Transform(state.doc).insert(1, documentSchema.text("x")).mapping,
  );
  expect(mapped).not.toBeNull();
  expect((mapped as AuthoredStep).undoOf).toBe(
    (tr.steps[0] as AuthoredStep).id,
  );
});

test("canvas author colors distinguish writers and leave unattributed text neutral", () => {
  const author = (id: string) =>
    documentSchema.marks.authorship.create({ author: id });
  const doc = documentSchema.node("doc", null, [
    documentSchema.node("paragraph", null, [
      documentSchema.text("A", [author("alice")]),
      documentSchema.text("B", [author("bob")]),
      documentSchema.text("C"),
      documentSchema.text("D", [author("alice")]),
    ]),
  ]);
  const labels = new Map([
    ["alice", "Alice"],
    ["bob", "Bob"],
  ]);
  const attributed = authorDisplayDecorations(
    doc,
    "color",
    labels,
    "alice",
  ).find();
  expect(attributed).toHaveLength(3);
  expect(authorTextClass("alice", "alice")).toBe("author-text-own");
  expect(authorTextClass("bob", "alice")).toBe("author-text");
  expect(authorHue("alice")).toBe(authorHue("alice"));
  expect(authorHue("alice")).not.toBe(authorHue("bob"));
  expect(
    authorDisplayDecorations(doc, "highlight", labels).find(),
  ).toHaveLength(4);
  expect(authorDisplayDecorations(doc, "off", labels).find()).toHaveLength(0);
  expect(doc.textContent).toBe("ABCD");
});
