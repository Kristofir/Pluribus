import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
export type SendView = {
  intentId: string;
  draftVersion: number;
  status: "pending" | "sending" | "sent" | "failed" | "uncertain";
  error?: string;
};
/** Parent supplies an immutable reviewed snapshot; sending must validate its version server-side. */
export function SendReview({
  recipients,
  reviewedText,
  draftVersion,
  currentVersion,
  send,
  blockedReason,
  onSend,
}: {
  recipients: readonly string[];
  reviewedText: string;
  draftVersion: number;
  currentVersion: number;
  send?: SendView;
  blockedReason?: string;
  onSend: (snapshot: {
    recipients: readonly string[];
    text: string;
    draftVersion: number;
  }) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const stale = draftVersion !== currentVersion;
  const status = send?.status ?? (uncertain ? "uncertain" : "review");
  const busy = submitting || status === "pending" || status === "sending";
  const reason =
    blockedReason ??
    (stale
      ? "The draft changed. Review its latest version before sending."
      : recipients.length === 0
        ? "Add recipients before sending."
        : !reviewedText.trim()
          ? "The reply is empty."
          : undefined);
  return (
    <section
      aria-label="Review reply before sending"
      className="space-y-4 border-t border-border pt-5"
    >
      <div className="flex justify-between gap-3">
        <h3 className="font-semibold">Review & send</h3>
        <Badge intent="secondary">{busy ? "Sending" : status}</Badge>
      </div>
      <p className="text-sm break-words">
        <strong>To</strong> {recipients.join(", ") || "No recipients"}
      </p>
      <p className="text-xs text-muted-fg">
        Reviewed draft · version {draftVersion}
      </p>
      <div className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border p-4 text-sm leading-6">
        {reviewedText || "No reply text yet."}
      </div>
      {reason && (
        <p role="status" className="text-sm">
          {reason}
        </p>
      )}
      {status === "sent" && (
        <p role="status" className="text-sm">
          This reviewed reply was sent.
        </p>
      )}
      {status === "uncertain" && (
        <p role="alert" className="text-sm">
          Delivery is unconfirmed. Check the message status before sending
          again.
        </p>
      )}
      {send?.error && (
        <p role="alert" className="text-sm">
          {send.error}
        </p>
      )}
      <Button
        isDisabled={
          !!reason ||
          busy ||
          status === "sent" ||
          status === "uncertain" ||
          uncertain
        }
        onPress={async () => {
          if (submitting) return;
          setSubmitting(true);
          try {
            await onSend({
              recipients: [...recipients],
              text: reviewedText,
              draftVersion,
            });
          } catch {
            setUncertain(true);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {busy
          ? "Sending…"
          : status === "failed"
            ? "Retry reviewed reply"
            : "Send reviewed reply"}
      </Button>
    </section>
  );
}
