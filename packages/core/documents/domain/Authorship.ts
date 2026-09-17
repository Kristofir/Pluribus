/** Restoration evidence is actor- and editing-generation-bound, independently of presence. */
export function assertRestoration(
  actor: string,
  session: string,
  evidence: {
    actor: string;
    session: string;
    scope: string;
    consumed: boolean;
  },
  scope: string,
) {
  if (
    actor !== evidence.actor ||
    session !== evidence.session ||
    scope !== evidence.scope ||
    evidence.consumed
  )
    throw new Error("Restoration is not authorized");
}
