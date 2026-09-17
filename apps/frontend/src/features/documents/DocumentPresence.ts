import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Step } from "@tiptap/pm/transform";
import { getVersion, sendableSteps } from "prosemirror-collab";
import {
  guestProfile,
  type InteractionEvent,
} from "@pluribus/core/presence/domain";
import {
  confirmedSelection,
  displayRange,
  mapRange,
  reconciliationLimit,
  type TextRange,
  type VersionedRange,
} from "./PresenceMapping";
import type { Member, RemoteActivity } from "../presence/Registry";
type Cursor = TextRange & { label: string; color: string };
type Message = { range: VersionedRange; sequence: number; member: Member };
/** Presence is plugin metadata/decorations only; it never adds document steps or history. */
export function createDocumentPresence(
  fetchSteps: (version: number) => Promise<{ steps: string[] }>,
  emit: (event: InteractionEvent) => void,
) {
  const key = new PluginKey<Map<string, Cursor>>("pluribus-presence");
  let editor: Editor | null = null,
    shown = true,
    disposed = false;
  const messages = new Map<string, Message>(),
    applied = new Map<string, number>(),
    attempted = new Map<string, string>(),
    busy = new Set<string>();
  let queued = false,
    awaitingMappableSelection = false,
    locallyEdited = false,
    confirmedVersion = 0;
  function schedule() {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      for (const [id, message] of messages) void reconcile(id, message);
    });
  }
  function update(id: string, cursor: Cursor | null) {
    if (editor && !editor.isDestroyed)
      editor.view.dispatch(
        editor.state.tr
          .setMeta(key, { id, cursor })
          .setMeta("addToHistory", false),
      );
  }
  async function reconcile(id: string, message: Message) {
    if (
      !editor ||
      editor.isDestroyed ||
      busy.has(id) ||
      applied.get(id) === message.sequence
    )
      return;
    const stamp = `${message.sequence}:${getVersion(editor.state)}:${sendableSteps(editor.state)?.steps.length ?? 0}:${editor.state.doc.content.size}`;
    if (attempted.get(id) === stamp) return;
    attempted.set(id, stamp);
    let current = getVersion(editor.state);
    if (message.range.version > current) return;
    if (current - message.range.version > reconciliationLimit) {
      update(id, null);
      return;
    }
    busy.add(id);
    try {
      const batch =
        current === message.range.version
          ? { steps: [] }
          : await fetchSteps(message.range.version);
      if (!editor || editor.isDestroyed || messages.get(id) !== message) return;
      current = getVersion(editor.state);
      const count = current - message.range.version;
      if (
        count < 0 ||
        count > reconciliationLimit ||
        batch.steps.length < count
      )
        return;
      const steps = batch.steps
        .slice(0, count)
        .map((step) => Step.fromJSON(editor!.schema, JSON.parse(step)));
      const range = displayRange(message.range, steps, editor.state),
        profile = guestProfile(message.member.guestId);
      if (range) {
        applied.set(id, message.sequence);
        update(id, {
          ...range,
          label: `${profile.name} · ${message.member.tabId.slice(0, 4)}`,
          color: profile.color,
        });
      } else update(id, null);
    } catch {
      update(id, null);
    } finally {
      busy.delete(id);
      schedule();
    }
  }
  function localSelection() {
    if (editor && !editor.isDestroyed) {
      const range = confirmedSelection(editor.state);
      awaitingMappableSelection = editor.isFocused && range === null;
      emit({
        type: "text-selection-changed",
        range,
        focused: editor.isFocused,
      });
    }
  }
  const extension = Extension.create({
    name: "pluribus-presence",
    onFocus() {
      if (editor !== this.editor) return;
      emit({ type: "editor-focused" });
      localSelection();
    },
    onBlur() {
      if (editor === this.editor) emit({ type: "editor-blurred" });
    },
    onTransaction({ transaction }) {
      if (editor !== this.editor) return;
      const version = getVersion(editor.state);
      const local =
        !transaction.getMeta(key) &&
        transaction.getMeta("rebased") === undefined &&
        (transaction.docChanged || transaction.selectionSet);
      if (local && transaction.docChanged) locallyEdited = true;
      // Remote rebases and own acknowledgements must never make every viewer publish.
      if (local) localSelection();
      else if (locallyEdited && version !== confirmedVersion) {
        localSelection();
        locallyEdited = !!sendableSteps(editor.state);
      } else if (
        awaitingMappableSelection &&
        editor &&
        confirmedSelection(editor.state)
      )
        localSelection();
      confirmedVersion = version;
      schedule();
    },
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key,
          state: {
            init: () => new Map(),
            apply: (tr, previous) => {
              const next = new Map<string, Cursor>();
              for (const [id, cursor] of previous) {
                const range = mapRange(cursor, tr.mapping);
                if (range) next.set(id, { ...cursor, ...range });
              }
              const change = tr.getMeta(key);
              if (change) {
                if (change.cursor) next.set(change.id, change.cursor);
                else next.delete(change.id);
              }
              return next;
            },
          },
          props: {
            decorations(state) {
              if (!shown) return DecorationSet.empty;
              const decorations: Decoration[] = [];
              for (const [id, cursor] of key.getState(state) ?? []) {
                if (cursor.anchor !== cursor.head)
                  decorations.push(
                    Decoration.inline(
                      Math.min(cursor.anchor, cursor.head),
                      Math.max(cursor.anchor, cursor.head),
                      {
                        style: `background-color:${cursor.color}33`,
                        class: "remote-text-selection",
                      },
                    ),
                  );
                decorations.push(
                  Decoration.widget(
                    cursor.head,
                    () => {
                      const mark = document.createElement("span");
                      mark.className = "remote-caret";
                      mark.style.borderColor = cursor.color;
                      mark.dataset.presenceSession = id;
                      const label = document.createElement("span");
                      label.className = "remote-caret-label";
                      label.style.background = cursor.color;
                      label.textContent = cursor.label;
                      mark.append(label);
                      return mark;
                    },
                    { key: id, side: 1 },
                  ),
                );
              }
              return DecorationSet.create(state.doc, decorations);
            },
          },
        }),
      ];
    },
  });
  return {
    extension,
    // React owns attachment; delayed callbacks from discarded editors cannot replace it.
    attach(value: Editor | null) {
      editor = value;
      disposed = !value;
      applied.clear();
      attempted.clear();
      schedule();
    },
    localSelection,
    receive(
      members: Member[],
      activities: RemoteActivity[],
      self: string | null,
      show: boolean,
    ) {
      shown = show;
      const valid = new Set<string>();
      for (const member of members) {
        if (member.id === self) continue;
        const row = activities.find(
          (a) => a.participationId === member.id && a.activity.kind === "text",
        );
        if (row?.activity.kind !== "text" || !row.activity.range) continue;
        valid.add(member.id);
        const prior = messages.get(member.id);
        if (!prior || row.sequence > prior.sequence) {
          messages.set(member.id, {
            range: row.activity.range,
            sequence: row.sequence,
            member,
          });
          applied.delete(member.id);
          attempted.delete(member.id);
          update(member.id, null);
        }
      }
      for (const id of messages.keys())
        if (!valid.has(id)) {
          messages.delete(id);
          applied.delete(id);
          attempted.delete(id);
          update(id, null);
        }
      // Redraw a visibility toggle without changing content or undo history.
      if (editor && !editor.isDestroyed)
        editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false));
      schedule();
    },
  };
}
