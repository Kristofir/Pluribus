import {
  prepareParagraphIds,
  freshParagraphSlice,
} from "@pluribus/editor/paragraphs";
import { Extension, type Editor } from "@tiptap/core";
import { Fragment, Slice, type Node } from "@tiptap/pm/model";
import {
  Selection,
  Plugin,
  PluginKey,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import {
  ReplaceStep,
  ReplaceAroundStep,
  Transform,
} from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { AuthoredStep } from "@pluribus/editor/protocol";
import { sendableSteps } from "prosemirror-collab";

function attributed(slice: Slice, author: string, state: EditorState) {
  const mark = state.schema.marks.authorship.create({ author });
  function visit(node: Node): Node {
    if (node.isText) return node.mark(mark.addToSet(node.marks));
    return node.copy(
      Fragment.fromArray(
        Array.from({ length: node.childCount }, (_, i) => visit(node.child(i))),
      ),
    );
  }
  return new Slice(
    Fragment.fromArray(
      Array.from({ length: slice.content.childCount }, (_, i) =>
        visit(slice.content.child(i)),
      ),
    ),
    slice.openStart,
    slice.openEnd,
  );
}
/** Prepare local steps before native history/collaboration see them; maps and step count stay unchanged. */
export function attributeTransaction(
  tr: Transaction,
  state: EditorState,
  author: string,
) {
  if (
    !tr.docChanged ||
    tr.getMeta("rebased") !== undefined ||
    tr.getMeta("addToHistory") === false
  )
    return;
  const transform = new Transform(tr.before);
  for (let i = 0; i < tr.steps.length; i++) {
    let step = tr.steps[i];
    if (!(step instanceof AuthoredStep)) {
      if (step instanceof ReplaceStep)
        step = new ReplaceStep(
          step.from,
          step.to,
          attributed(step.slice, author, state),
        );
      else if (step instanceof ReplaceAroundStep)
        step = new ReplaceAroundStep(
          step.from,
          step.to,
          step.gapFrom,
          step.gapTo,
          attributed(step.slice, author, state),
          step.insert,
          !!step.toJSON().structure,
        );
      step = new AuthoredStep(step, crypto.randomUUID());
    }
    tr.docs[i] = transform.doc;
    tr.steps[i] = step;
    transform.step(step);
  }
  const selection = tr.selection.toJSON();
  tr.doc = transform.doc;
  tr.setSelection(Selection.fromJSON(tr.doc, selection));
}
export function createAuthorshipExtension(author: string, paragraphs = false) {
  const key = new PluginKey("authorship-display");
  let shown = false;
  let labels = new Map<string, string>();
  return {
    setDisplay(editor: Editor, show: boolean, names: Map<string, string>) {
      shown = show;
      labels = names;
      editor.view.dispatch(
        editor.state.tr.setMeta(key, true).setMeta("addToHistory", false),
      );
    },
    extension: Extension.create({
      name: "authorship-policy",
      dispatchTransaction({ transaction, next }) {
        if (paragraphs)
          prepareParagraphIds(transaction, () => crypto.randomUUID());
        attributeTransaction(transaction, this.editor.state, author);
        next(transaction);
      },
      addProseMirrorPlugins() {
        return [
          new Plugin({
            key,
            props: {
              transformPasted: (slice, view) =>
                paragraphs && !view.dragging
                  ? freshParagraphSlice(slice)
                  : slice,
              decorations(state) {
                if (!shown) return DecorationSet.empty;
                const decorations: Decoration[] = [];
                state.doc.descendants((node, pos) => {
                  if (!node.isText) return;
                  const id = node.marks.find(
                    (mark) => mark.type.name === "authorship",
                  )?.attrs.author as string | undefined;
                  let hash = 0;
                  for (const c of id ?? "unknown")
                    hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
                  decorations.push(
                    Decoration.inline(pos, pos + node.nodeSize, {
                      class: "author-span",
                      title: id
                        ? (labels.get(id) ?? "Author details loading…")
                        : "Unknown author (existing text)",
                      style: `background-color: hsl(${hash % 360} 70% 80% / 0.45)`,
                    }),
                  );
                });
                return DecorationSet.create(state.doc, decorations);
              },
            },
          }),
        ];
      },
      addKeyboardShortcuts() {
        return {
          "Mod-z": () => !!sendableSteps(this.editor.state),
          "Mod-Shift-z": () => !!sendableSteps(this.editor.state),
          "Mod-y": () => !!sendableSteps(this.editor.state),
        };
      },
      priority: 1000,
    }),
  };
}
/** Explicit move is one synced transaction; source marks are preserved instead of treated as pasted text. */
export function moveSelection(
  editor: Editor,
  source: { from: number; to: number },
  target: number,
) {
  if (
    sendableSteps(editor.state) ||
    (target >= source.from && target <= source.to)
  )
    return false;
  const slice = editor.state.doc.slice(source.from, source.to);
  const tr = editor.state.tr,
    group = crypto.randomUUID();
  tr.step(
    new AuthoredStep(
      new ReplaceStep(source.from, source.to, Slice.empty),
      crypto.randomUUID(),
      undefined,
      { group, part: "remove", ...source },
    ),
  );
  const position = tr.mapping.map(target);
  tr.step(
    new AuthoredStep(
      new ReplaceStep(position, position, slice),
      crypto.randomUUID(),
      undefined,
      { group, part: "insert", ...source },
    ),
  );
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}
