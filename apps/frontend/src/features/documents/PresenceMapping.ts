import { Mapping, type Step } from "@tiptap/pm/transform";
import { getVersion, sendableSteps } from "prosemirror-collab";
import type { EditorState } from "@tiptap/pm/state";
export type TextRange = { anchor: number; head: number };
export type VersionedRange = TextRange & { version: number };
export const reconciliationLimit = 256;
export function mapRange(
  range: TextRange,
  mapping: Mapping,
  allowInsertionBoundary = false,
): TextRange | null {
  // Without the originating editor's selection intent, an insertion exactly at
  // an endpoint is ambiguous. Hide it until that editor publishes a fresh range.
  if (!allowInsertionBoundary) {
    let anchor = range.anchor,
      head = range.head;
    for (const map of mapping.maps) {
      let ambiguous = false;
      map.forEach((from, to) => {
        if (from === to && (anchor === from || head === from)) ambiguous = true;
      });
      if (ambiguous) return null;
      anchor = map.map(anchor);
      head = map.map(head);
    }
  }
  const caret = range.anchor === range.head,
    forward = range.anchor < range.head;
  const anchor = mapping.mapResult(range.anchor, caret || forward ? 1 : -1);
  const head = mapping.mapResult(range.head, caret || !forward ? 1 : -1);
  if (anchor.deletedAcross || head.deletedAcross) return null;
  return { anchor: anchor.pos, head: head.pos };
}
export function stepMapping(steps: readonly Step[]) {
  return new Mapping(steps.map((step) => step.getMap()));
}
/** Publish in confirmed coordinates, even with pending edits; unseen interiors are unmappable. */
export function confirmedSelection(state: EditorState): VersionedRange | null {
  const pending = sendableSteps(state);
  const range = mapRange(
    state.selection,
    pending ? stepMapping(pending.steps).invert() : new Mapping(),
    true,
  );
  return range ? { ...range, version: getVersion(state) } : null;
}
export function displayRange(
  range: TextRange,
  accepted: readonly Step[],
  state: EditorState,
): TextRange | null {
  const mapping = stepMapping(accepted);
  const pending = sendableSteps(state);
  if (pending) mapping.appendMapping(stepMapping(pending.steps));
  const mapped = mapRange(range, mapping);
  return mapped &&
    Math.max(mapped.anchor, mapped.head) <= state.doc.content.size
    ? mapped
    : null;
}
