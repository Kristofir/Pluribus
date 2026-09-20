import type { HistoryOutcome } from "../../domain/History";
export function outcome(
  action: string,
  status: HistoryOutcome["status"],
  message: string | null = null,
): HistoryOutcome {
  return { action, status, message, revision: 0, id: null, sequence: 0 };
}
