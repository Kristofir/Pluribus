import { expect, test, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { Schema } from "@tiptap/pm/model";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { collab } from "prosemirror-collab";
import { createDocumentPresence } from "./DocumentPresence";
import type { Member } from "../presence/Registry";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "text*" },
    text: {},
  },
});
test("passive rendering stays attached to the live editor after stale editor callbacks", async () => {
  const emit = vi.fn();
  const presence = createDocumentPresence(async () => ({ steps: [] }), emit);
  const plugins = presence.extension.config.addProseMirrorPlugins!.call(
    {} as never,
  );
  function fakeEditor() {
    const target = {
      isDestroyed: false,
      isFocused: false,
      state: EditorState.create({
        schema,
        doc: schema.node("doc", null, [
          schema.node("paragraph", null, schema.text("hello")),
        ]),
        plugins: [collab({ version: 1 }), ...plugins],
      }),
      view: {
        dispatch(tr: Transaction) {
          target.state = target.state.apply(tr);
        },
      },
    };
    return target as unknown as Editor;
  }
  const old = fakeEditor(),
    live = fakeEditor();
  presence.attach(old);
  presence.attach(null);
  presence.attach(live);
  const member = {
    id: "peer" as Member["id"],
    guestId: "guest",
    tabId: "tab",
    hidden: true,
    focused: false,
  };
  const receive = (sequence: number, head: number) =>
    presence.receive(
      [member],
      [
        {
          participationId: member.id,
          sequence,
          activity: { kind: "text", range: { version: 1, anchor: 1, head } },
        },
      ],
      null,
      true,
    );
  receive(1, 2);
  await Promise.resolve();
  expect(plugins[0].getState(live.state).get("peer")).toMatchObject({
    anchor: 1,
    head: 2,
  });
  presence.extension.config.onFocus!.call(
    { editor: old } as never,
    {} as never,
  );
  presence.extension.config.onTransaction!.call(
    { editor: old } as never,
    { transaction: old.state.tr } as never,
  );
  receive(2, 3);
  await Promise.resolve();
  expect(plugins[0].getState(live.state).get("peer")).toMatchObject({
    anchor: 1,
    head: 3,
  });
  expect(plugins[0].getState(old.state).size).toBe(0);
  expect(emit).not.toHaveBeenCalled();
  presence.receive([], [], null, true);
  expect(plugins[0].getState(live.state).size).toBe(0);
  presence.attach(null);
});
