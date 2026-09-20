import { ConvexError } from "convex/values";

export function terminalHistoryError(error: unknown): string | null {
  if (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data &&
    "code" in error.data &&
    error.data.code === "HISTORY_REJECTED"
  )
    return "message" in error.data
      ? String(error.data.message)
      : "History request rejected.";
  return null;
}
