import type { Id } from "@pluribus/backend/dataModel";
import { api } from "@pluribus/backend/api";
import { useMutation } from "convex/react";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { WebPagePanel } from "./WebPagePanel";
/** Load full content only while a capture is open; source revisions remain server-owned. */
export function WebPageCapturePanel({
  id,
  workspaceId,
  onClose,
  disabled,
}: {
  id: Id<"sources">;
  workspaceId: Id<"workspaces">;
  onClose: () => void;
  disabled: boolean;
}) {
  const query = useRetainedQuery(api.Sources.get, { id, workspaceId });
  const request = useMutation(api.Sources.request);
  const recover = useMutation(api.Sources.recover);
  const row = query.data;
  if (!row)
    return (
      <aside aria-label="Web page capture">
        <button onClick={onClose}>Close</button>
        <p role={query.failed ? "alert" : "status"}>
          {query.failed
            ? "Capture unavailable. Try again when access recovers."
            : row === null
              ? "This Web Page was removed."
              : "Loading capture…"}
        </p>
      </aside>
    );
  return (
    <>
      {query.failed && (
        <p role="alert">
          Capture updates unavailable; showing the last received content.
        </p>
      )}
      <WebPagePanel
        source={{
          ...row,
          title: row.capture?.title,
          hasCapture: !!row.capture,
        }}
        disabled={disabled || query.failed}
        onClose={onClose}
        onRecover={async () => {
          if (disabled || query.failed) return false;
          return recover({ workspaceId, id, revision: row.revision });
        }}
        onRefresh={async () => {
          if (!disabled && !query.failed)
            await request({
              workspaceId,
              sourceId: id,
              url: row.url,
              prompt: row.prompt,
              expectedRevision: row.revision,
            });
        }}
      />
    </>
  );
}
