export type DeliveryOutcome =
  | { status: "sent"; messageId: string }
  | { status: "failed" | "unknown"; error: string };
/** One claimed send makes at most one provider call. Unknown delivery is never retried automatically. */
export async function deliverIntent<T>(ports: {
  claim(): Promise<T | null>;
  send(intent: T): Promise<{ messageId: string }>;
  finish(outcome: DeliveryOutcome): Promise<void>;
}) {
  const intent = await ports.claim();
  if (!intent) return;
  let outcome: DeliveryOutcome;
  try {
    const result = await ports.send(intent);
    outcome = { status: "sent", messageId: result.messageId };
  } catch {
    outcome = {
      status: "unknown",
      error:
        "Delivery could not be confirmed. Do not resend without checking the inbox.",
    };
  }
  await ports.finish(outcome);
}
