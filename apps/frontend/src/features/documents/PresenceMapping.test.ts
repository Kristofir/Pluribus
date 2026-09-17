import { expect, test } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import { collab, receiveTransaction } from "prosemirror-collab";
import {
  confirmedSelection,
  displayRange,
  mapRange,
  stepMapping,
} from "./PresenceMapping";
const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "text*" },
    text: {},
  },
});
function initial() {
  return EditorState.create({
    doc: schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("hello world")),
    ]),
    plugins: [collab({ version: 1, clientID: "a" })],
  });
}
test("caret at the end of unconfirmed typing is publishable before acknowledgement", () => {
  let state = initial();
  state = state.apply(state.tr.insertText("ABC", 6));
  state = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, 9)),
  );
  expect(confirmedSelection(state)).toEqual({ version: 1, anchor: 6, head: 6 });
  state = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, 7)),
  );
  expect(confirmedSelection(state)).toBeNull();
});
test("received positions map through accepted and local unconfirmed edits", () => {
  const start = initial();
  const accepted = start.tr.insertText("remote", 1).steps;
  let state = start.apply(receiveTransaction(start, accepted, ["b"]));
  state = state.apply(state.tr.insertText("local", 1));
  expect(displayRange({ anchor: 6, head: 6 }, accepted, state)).toEqual({
    anchor: 17,
    head: 17,
  });
});
test("transaction mapping follows rebases and hides deleted interiors", () => {
  let state = initial();
  const local = state.tr.insertText("local", 1);
  state = state.apply(local);
  const cursor = mapRange({ anchor: 8, head: 8 }, local.mapping)!;
  const remote = initial().tr.insertText("remote", 1);
  const rebased = receiveTransaction(state, remote.steps, ["b"]);
  expect(mapRange(cursor, rebased.mapping)).toEqual({ anchor: 19, head: 19 });
  const deletion = initial().tr.delete(2, 9);
  expect(mapRange({ anchor: 5, head: 5 }, deletion.mapping)).toBeNull();
  expect(mapRange({ anchor: 3, head: 7 }, new Mapping())).toEqual({
    anchor: 3,
    head: 7,
  });
  expect(stepMapping(remote.steps).maps).toHaveLength(1);
});

test("insertion at a remote endpoint is hidden rather than guessing the writer's cursor affinity", () => {
  const insertion = initial().tr.insertText("other", 6);
  expect(mapRange({ anchor: 6, head: 6 }, insertion.mapping)).toBeNull();
});
