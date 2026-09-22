import { useRef, useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { Button } from "@/components/ui/Button";
import { AgentContextPanel, type PassageReference } from "./AgentContextPanel";
import { AgentChangesPanel } from "./AgentChangesPanel";
export type SelectedPassage = PassageReference & {
  version: number;
  text: string;
};
export function AgentAccessControls({
  workspaceId,
  documentIds,
  selected,
  passages,
  onRemoveElement,
  onRemovePassage,
  paused = false,
}: {
  paused?: boolean;
  workspaceId: Id<"workspaces">;
  documentIds: readonly Id<"documents">[];
  selected: string[];
  passages: SelectedPassage[];
  onRemoveElement: (id: string) => void;
  onRemovePassage: (p: PassageReference) => void;
}) {
  const client = useConvex();
  const changes = useRetainedQuery(api.AgentAccess.changes, { workspaceId });
  const info = useRetainedQuery(api.AgentAccess.connectionInfo, {
    workspaceId,
  });
  const prepare = useMutation(api.AgentAccess.prepare),
    grant = useMutation(api.AgentAccess.grant),
    revoke = useMutation(api.AgentAccess.revoke),
    undo = useMutation(api.AgentAccess.undo);
  const [prepared, setPrepared] = useState<{
    id: Id<"agentContexts">;
    documentIds: Id<"documents">[];
    count: number;
  }>();
  const [connection, setConnection] = useState<{
    grantId: Id<"agentGrants">;
    text: string;
  }>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const requests = useRef(new Map<string, string>());
  const labels = Object.fromEntries(
    passages.map((p) => [
      `${p.documentId}:${p.paragraphId}`,
      `${p.text.slice(0, 100) || "Empty paragraph"} · version ${p.version}`,
    ]),
  );
  return (
    <section aria-label="Agent access" className="space-y-5">
      <AgentContextPanel
        unavailableReason={
          paused
            ? "Workspace access unavailable."
            : connection
              ? "Revoke the current connection before preparing another context snapshot."
              : undefined
        }
        context={{ elementIds: selected, passages }}
        labels={labels}
        onRemoveElement={onRemoveElement}
        onRemovePassage={onRemovePassage}
        connectionDetails={connection?.text}
        onPrepare={async () => {
          if (paused) throw new Error("Workspace unavailable");
          setError(undefined);
          try {
            // These are the versions captured when the user selected the passages.
            const id = await prepare({
              workspaceId,
              elementIds: selected as (Id<"canvasDocuments"> | Id<"sources">)[],
              passages: passages.map((p) => ({
                documentId: p.documentId as Id<"documents">,
                paragraphId: p.paragraphId,
                version: p.version,
              })),
            });
            const cards = await client.query(api.Canvas.documentCards, {
              workspaceId,
            });
            const ids = [
              ...new Set([
                ...documentIds,
                ...passages.map((p) => p.documentId as Id<"documents">),
                ...cards
                  .filter((card) => selected.includes(card.id))
                  .map((card) => card.documentId),
              ]),
            ];
            setPrepared({
              id,
              documentIds: ids,
              count: selected.length + passages.length,
            });
          } catch {
            setError(
              "Context could not be prepared. A selected passage may have changed or disappeared; remove it and select the current version again.",
            );
            throw new Error("Context unavailable");
          }
        }}
      />
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      {prepared && (
        <div className="rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-semibold">Allow external agent access</h3>
          <p className="text-sm">
            Prepared snapshot of {prepared.count} items. Prepare again to change
            its material. Creating a connection grants read and write access to
            these {prepared.documentIds.length} documents. Context selection
            alone grants no access.
          </p>
          <ul className="text-xs break-all space-y-1">
            {prepared.documentIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-fg">
            Keep the connection secret private. Closing this panel does not
            revoke access; revoke it before leaving this workspace.
          </p>
          {!info.data?.url && (
            <p role="status" className="text-sm">
              {info.failed
                ? "Could not load the MCP endpoint."
                : "MCP endpoint is not configured or is still loading."}
            </p>
          )}
          <Button
            isDisabled={
              paused ||
              busy ||
              !info.data?.url ||
              !!connection ||
              prepared.documentIds.length === 0
            }
            onPress={async () => {
              if (!info.data?.url) return;
              setBusy(true);
              setError(undefined);
              try {
                const next = await grant({
                  workspaceId,
                  documentIds: prepared.documentIds,
                  label: "External agent",
                });
                setConnection({
                  grantId: next.grantId,
                  text: JSON.stringify(
                    {
                      url: info.data.url,
                      headers: { Authorization: `Bearer ${next.token}` },
                      contextSnapshotId: prepared.id,
                      documentIds: prepared.documentIds,
                    },
                    null,
                    2,
                  ),
                });
              } catch {
                setError(
                  "Agent access could not be created. No connection is available here.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Create read/write connection
          </Button>
        </div>
      )}
      {connection && (
        <Button
          intent="outline"
          isDisabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await revoke({ grantId: connection.grantId });
              setConnection(undefined);
            } catch {
              setError(
                "Revocation was not confirmed. Treat this connection as active and try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Revoke agent access
        </Button>
      )}
      <AgentChangesPanel
        changes={(changes.data ?? []).map((change) => ({
          id: change.id,
          author: "External agent",
          summary: `Document ${change.documentId.slice(-6)} · change accepted at version ${change.version}`,
          status: change.undone ? "undone" : "applied",
          undoUnavailableReason: change.canUndo
            ? undefined
            : "Only the initiating user can undo this change.",
        }))}
        loading={!changes.data && !changes.failed}
        error={changes.failed ? "Agent changes unavailable." : undefined}
        onUndo={async (id) => {
          if (paused) throw new Error("Workspace unavailable");
          let requestId = requests.current.get(id);
          if (!requestId) {
            requestId = crypto.randomUUID();
            requests.current.set(id, requestId);
          }
          try {
            await undo({ changeId: id as Id<"agentChanges">, requestId });
          } catch {
            setError(
              "Undo was not applied or confirmed. The change may conflict with later human edits. No overwrite will be attempted.",
            );
            throw new Error("Undo unavailable");
          }
        }}
      />
    </section>
  );
}
