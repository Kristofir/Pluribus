import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { useClipboard } from "../../hooks/UseClipboard";
import { Button } from "@/components/ui/Button";
import { AgentChangesPanel } from "./AgentChangesPanel";
export function AgentAccessControls({
  workspaceId,
  paused = false,
}: {
  paused?: boolean;
  workspaceId: Id<"workspaces">;
}) {
  const changes = useRetainedQuery(api.AgentAccess.changes, { workspaceId });
  const info = useRetainedQuery(api.AgentAccess.connectionInfo, {
    workspaceId,
  });
  const grant = useMutation(api.AgentAccess.grant),
    revoke = useMutation(api.AgentAccess.revoke),
    undo = useMutation(api.AgentAccess.undo);
  const [agentLabel, setAgentLabel] = useState("External agent");
  const [connection, setConnection] = useState<{
    grantId: Id<"agentGrants">;
    token: string;
    url: string;
  }>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const { copy: copyConnection, copied: connectionCopied } = useClipboard();
  const requests = useRef(new Map<string, string>());
  const connectionDetails = connection
    ? JSON.stringify(
        {
          url: connection.url,
          headers: { Authorization: `Bearer ${connection.token}` },
          scope: "workspace",
        },
        null,
        2,
      )
    : undefined;
  return (
    <section aria-label="Agent access" className="space-y-5">
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <h3 tabIndex={-1} className="font-semibold">
          Connect an agent
        </h3>
        <p className="text-sm">
          Create a connection, add its URL and bearer token to an MCP client as
          a Streamable HTTP server, then ask the agent to call{" "}
          <code>read_canvas</code>
          to check the connection. The URL alone cannot access this workspace.
        </p>
        {/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\//.test(
          info.data?.url ?? "",
        ) && (
          <p className="text-sm">
            This MCP endpoint is local to this computer. A remote agent needs an
            HTTPS deployment and a workspace connection token.
          </p>
        )}
        <p className="text-sm">
          This connection grants access to the workspace's canvas, saved Web
          Pages and documents, including documents added later.
        </p>
        <label className="block text-sm">
          Agent name
          <input
            aria-label="Agent name"
            className="mt-1 block w-full rounded border border-border bg-background px-2 py-1"
            value={agentLabel}
            maxLength={80}
            onChange={(event) => setAgentLabel(event.target.value)}
          />
        </label>
        <p className="text-xs text-muted-fg">
          Keep the connection secret private. Closing this panel does not revoke
          access; revoke it before leaving this workspace.
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
            !agentLabel.trim()
          }
          onPress={async () => {
            if (!info.data?.url) return;
            setBusy(true);
            setError(undefined);
            try {
              const next = await grant({
                workspaceId,
                label: agentLabel.trim(),
              });
              setConnection({
                grantId: next.grantId,
                token: next.token,
                url: info.data.url,
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
          Create workspace connection
        </Button>
        {connectionDetails && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium">Connection details</p>
            <p className="text-xs text-muted-fg">
              The bearer token is shown only here. Keep it private. Closing this
              panel does not revoke access.
            </p>
            <pre className="text-xs whitespace-pre-wrap break-all">
              {connectionDetails}
            </pre>
            <Button
              intent="outline"
              onPress={() => {
                void copyConnection(connectionDetails).then((copied) => {
                  if (!copied) setError("Could not copy connection details.");
                });
              }}
            >
              {connectionCopied
                ? "Copied connection details"
                : "Copy connection details"}
            </Button>
          </div>
        )}
      </div>
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
          author: change.author,
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
