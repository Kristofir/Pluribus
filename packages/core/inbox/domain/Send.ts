export type SendStatus = "pending" | "sending" | "sent" | "failed" | "unknown";
export function assertReviewedDraft(
  current: { version: number; text: string },
  reviewed: { version: number; text: string; recipients: string[] },
) {
  if (current.version !== reviewed.version || current.text !== reviewed.text)
    throw new Error("Draft changed; review the saved version again");
  if (
    !reviewed.text.trim() ||
    reviewed.text.length > 100000 ||
    !reviewed.recipients.length ||
    reviewed.recipients.length > 20 ||
    reviewed.recipients.some(
      (r) => !/^\S+@[^\s@]+\.[^\s@]+$/.test(r) || /[\r\n<>]/.test(r),
    )
  )
    throw new Error("Invalid reviewed message");
}
/** Only a never-dispatched intent may send; uncertain delivery never means permission to resend. */
export const canDispatchSend = (status: SendStatus) => status === "pending";
