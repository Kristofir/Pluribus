import { Extension } from "@tiptap/core";
import { Fragment, Slice, type Node } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

/** Canonical block anchors survive content edits and are shared by editor and server. */
export const ParagraphAttributes = Extension.create({
 name: "paragraph-identity",
 addGlobalAttributes() { return [{ types: ["paragraph", "heading"], attributes: { paragraphId: { default: null, parseHTML: () => null, renderHTML: attrs => attrs.paragraphId ? { "data-paragraph-id": attrs.paragraphId } : {} } } }]; }
});
export function paragraphRows(doc: Node) {
 const rows: { id: string; from: number; to: number; text: string }[] = [];
 doc.descendants((node, pos) => { if (node.type.name === "paragraph" || node.type.name === "heading") rows.push({ id: node.attrs.paragraphId, from: pos, to: pos + node.nodeSize, text: node.textContent }); });
 return rows;
}
export function assertParagraphIds(doc: Node) {
 const seen = new Set<string>();
 for (const p of paragraphRows(doc)) {
  if (typeof p.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(p.id) || seen.has(p.id)) throw new Error("Missing or duplicate paragraph identity");
  seen.add(p.id);
 }
}
/** Add normal submitted steps before authorship/collaboration observes the transaction. */
export function prepareParagraphIds(tr: Transaction, token: () => string) {
 if (!tr.docChanged || tr.getMeta("rebased") !== undefined || tr.getMeta("addToHistory") === false) return;
 const preferred = new Map(paragraphRows(tr.before).filter(p => p.id).map(p => [p.id, tr.mapping.map(p.from, 1)]));
 const rows = paragraphRows(tr.doc), retained = new Set<string>();
 for (const p of rows) {
  const duplicate = rows.some(other => other !== p && other.id === p.id);
  const original = preferred.get(p.id);
  if (!p.id || retained.has(p.id) || (duplicate && original !== undefined && original !== p.from && rows.some(other => other.id === p.id && other.from === original))) {
   const node = tr.doc.nodeAt(p.from)!;
   tr.setNodeMarkup(p.from, undefined, { ...node.attrs, paragraphId: token() });
  } else retained.add(p.id);
 }
}
/** Clipboard imports create new identities. Explicit in-document moves keep their slice. */
export function freshParagraphSlice(slice: Slice) {
 const visit = (node: Node): Node => node.isText ? node : node.type.create({ ...node.attrs, ...(node.type.name === "paragraph" || node.type.name === "heading" ? { paragraphId: null } : {}) }, Fragment.fromArray(Array.from({ length: node.childCount }, (_, i) => visit(node.child(i)))), node.marks);
 return new Slice(Fragment.fromArray(Array.from({ length: slice.content.childCount }, (_, i) => visit(slice.content.child(i)))), slice.openStart, slice.openEnd);
}
