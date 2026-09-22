import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { Button } from "@/components/ui/Button";
import { SendReview } from "./SendReview";
type Review = FunctionReturnType<typeof api.Inbox.review> & {
  requestId: string;
};
export function ReplyReview({
  threadId,
  pending,
  paused,
}: {
  threadId: Id<"inboxThreads">;
  pending: boolean;
  paused: boolean;
}) {
  const client = useConvex(),
    send = useMutation(api.Inbox.send),
    reconcile = useMutation(api.Inbox.reconcile);
  const current = useRetainedQuery(api.Inbox.review, { threadId }),
    delivery = useRetainedQuery(api.Inbox.delivery, { threadId });
  const [review, setReview] = useState<Review>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState<{
    intentId?: Id<"sendIntents">;
    uncertain: boolean;
  }>();
  const submission = useRetainedQuery(
    api.Inbox.submission,
    attempt && review ? { threadId, requestId: review.requestId } : "skip",
  );
  // A previous thread delivery must never be presented as the result of this review.
  const ownDelivery =
    submission.data ??
    (attempt?.intentId && attempt.intentId === delivery.data?.intentId
      ? delivery.data
      : undefined);
  const unsettled =
    !!delivery.data &&
    ["pending", "sending", "unknown"].includes(delivery.data.status);
  const unresolved =
    !!attempt &&
    (!ownDelivery ||
      ["pending", "sending", "unknown"].includes(ownDelivery.status));
  const changed =
    review &&
    current.data &&
    (review.version !== current.data.version ||
      review.generation !== current.data.generation ||
      review.reviewedMessageId !== current.data.reviewedMessageId ||
      JSON.stringify(review.recipients) !==
        JSON.stringify(current.data.recipients));
  const blocked = paused
    ? "Editing is paused while workspace access is unavailable."
    : pending
      ? "Wait for all local edits to save before reviewing or sending."
      : current.failed || delivery.failed || submission.failed
        ? "Draft or delivery status is unavailable."
        : !current.data || delivery.data === undefined
          ? "Loading saved draft and delivery status…"
          : changed
            ? "The draft or reply target changed. Review the latest version before sending."
            : !review?.reviewedMessageId
              ? "There is no received message to reply to."
              : undefined;
  return (
    <section className="mt-8 space-y-4" aria-label="Reply delivery">
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      <Button
        intent="outline"
        isDisabled={
          pending ||
          paused ||
          busy ||
          unsettled ||
          unresolved ||
          current.failed ||
          delivery.failed ||
          submission.failed ||
          !current.data ||
          delivery.data === undefined
        }
        onPress={async () => {
          setBusy(true);
          setError(undefined);
          try {
            const saved = await client.query(api.Inbox.review, { threadId });
            setReview({ ...saved, requestId: crypto.randomUUID() });
            setAttempt(undefined);
          } catch {
            setError("The saved draft could not be loaded for review.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Loading…"
          : review
            ? "Review latest saved draft"
            : "Review before sending"}
      </Button>
      {review && (
        <SendReview
          key={review.requestId}
          recipients={review.recipients}
          reviewedText={review.text}
          draftVersion={review.version}
          currentVersion={current.data?.version ?? review.version}
          blockedReason={
            blocked ??
            (ownDelivery?.status === "failed"
              ? "Delivery failed. Review the latest saved draft before making a new attempt."
              : undefined) ??
            (unsettled && !ownDelivery
              ? "Another delivery is still unresolved."
              : undefined)
          }
          send={
            ownDelivery
              ? {
                  ...ownDelivery,
                  status:
                    ownDelivery.status === "unknown"
                      ? "uncertain"
                      : ownDelivery.status,
                }
              : attempt
                ? {
                    intentId: attempt.intentId ?? review.requestId,
                    draftVersion: review.version,
                    status: attempt.uncertain ? "uncertain" : "pending",
                  }
                : undefined
          }
          onSend={async () => {
            if (blocked || !review.reviewedMessageId || unsettled || attempt)
              throw new Error("Send blocked");
            setAttempt({ uncertain: false });
            try {
              // Submit exactly the reviewed target, text, recipients and version.
              const intentId = await send({
                threadId,
                requestId: review.requestId,
                reviewedMessageId: review.reviewedMessageId,
                draftVersion: review.version,
                text: review.text,
                recipients: review.recipients,
              });
              setAttempt({ intentId, uncertain: false });
            } catch {
              setAttempt({ uncertain: true });

              throw new Error("Submission unconfirmed");
            }
          }}
        />
      )}
      {attempt?.uncertain && !ownDelivery && (
        <p role="alert" className="text-sm">
          Submission was not confirmed. Do not send a new copy. Keep this review
          open while its exact request is checked.
        </p>
      )}
      {delivery.data && !ownDelivery && (
        <p role="status" className="text-sm">
          Latest thread delivery:{" "}
          {delivery.data.status === "unknown"
            ? "unconfirmed"
            : delivery.data.status}
          {delivery.data.error ? ` — ${delivery.data.error}` : ""}.{" "}
          {attempt && "This is not yet confirmed as the current submission."}
        </p>
      )}
      {(ownDelivery?.status === "unknown" ||
        delivery.data?.status === "unknown" ||
        (attempt?.uncertain && !ownDelivery)) && (
        <Button
          intent="outline"
          isDisabled={busy || paused || delivery.failed}
          onPress={async () => {
            setBusy(true);
            setError(undefined);
            try {
              await reconcile({ threadId });
            } catch {
              setError(
                "Delivery could not be confirmed. Do not resend while its status is unknown.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Check delivery
        </Button>
      )}
    </section>
  );
}
