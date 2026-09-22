export type AgentParagraphEdit =
  | { kind: "replace"; paragraphId: string; text: string }
  | { kind: "delete"; paragraphId: string }
  | { kind: "insert"; afterParagraphId: string | null; text: string };
/** Narrow, bounded commands avoid an unrestricted document replacement surface. */
export function assertAgentEdits(edits: readonly AgentParagraphEdit[]) {
  if (!edits.length || edits.length > 20)
    throw new Error("Use between 1 and 20 paragraph edits");
  if (edits.reduce((n, e) => n + ("text" in e ? e.text.length : 0), 0) > 20000)
    throw new Error("Agent edit exceeds text limit");
  const targets = new Set<string>();
  for (const e of edits) {
    if (e.kind !== "insert") {
      if (targets.has(e.paragraphId))
        throw new Error("Repeated paragraph target");
      targets.add(e.paragraphId);
    }
    if ("text" in e && /\r|\n/.test(e.text))
      throw new Error("One paragraph per edit");
  }
}
