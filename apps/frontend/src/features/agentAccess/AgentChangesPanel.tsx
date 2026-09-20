import { useState } from "react";
import { Button } from "@/components/ui/Button";
export type AgentChange = {
  id: string;
  author: string;
  summary: string;
  status: "applied" | "undone" | "conflict";
  undoUnavailableReason?: string;
};
export function AgentChangesPanel({
  changes,
  loading,
  error,
  onUndo,
}: {
  changes: readonly AgentChange[];
  loading: boolean;
  error?: string;
  onUndo: (changeId: string) => Promise<void>;
}) {
  const [pending, setPending] = useState<string>();
  const [failure, setFailure] = useState<string>();
  return (
    <section
      aria-label="Agent changes"
      className="p-5 rounded-xl border border-border bg-overlay text-fg space-y-4"
    >
      <h2 className="font-semibold">Agent changes</h2>
      <p className="text-sm text-muted-fg">
        Review attributed changes. Undo requests are checked against intervening
        edits.
      </p>
      {(error || failure) && (
        <p role="alert" className="text-sm">
          {error ?? failure}
        </p>
      )}
      {loading ? (
        <p role="status">Loading changes…</p>
      ) : changes.length === 0 ? (
        <p className="text-sm text-muted-fg">No agent changes to review.</p>
      ) : (
        <ul className="space-y-4">
          {changes.map((change) => (
            <li
              key={change.id}
              className="border-t border-border pt-4 space-y-2"
            >
              <p className="font-medium text-sm">{change.author}</p>
              <p className="text-sm">{change.summary}</p>
              <p className="text-xs text-muted-fg">
                {change.status === "undone"
                  ? "Undone"
                  : change.status === "conflict"
                    ? "Conflict — other edits prevent this undo"
                    : "Applied"}
              </p>
              {change.undoUnavailableReason && (
                <p className="text-xs">{change.undoUnavailableReason}</p>
              )}
              {change.status === "applied" && (
                <Button
                  intent="outline"
                  size="sm"
                  isDisabled={!!pending || !!change.undoUnavailableReason}
                  onPress={async () => {
                    setPending(change.id);
                    setFailure(undefined);
                    try {
                      await onUndo(change.id);
                    } catch {
                      setFailure(
                        "This change could not be undone. Refresh its status before trying again.",
                      );
                    } finally {
                      setPending(undefined);
                    }
                  }}
                >
                  {pending === change.id ? "Undoing…" : "Undo this change"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
