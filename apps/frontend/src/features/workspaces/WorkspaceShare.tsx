import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { Button } from "@/components/ui/Button";
import { useClipboard } from "../../hooks/UseClipboard";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";

export function WorkspaceShare({
  workspaceId,
  onClose,
  paused,
}: {
  workspaceId: Id<"workspaces">;
  onClose: () => void;
  paused: boolean;
}) {
  const status = useRetainedQuery(api.ShareLinks.status, { workspaceId });
  const create = useMutation(api.ShareLinks.create);
  const revoke = useMutation(api.ShareLinks.revoke);
  const [token, setToken] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const { copy, copied } = useClipboard();
  const url = token ? `${window.location.origin}/share#${token}` : undefined;
  const localOnly = ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname,
  );
  return (
    <aside aria-label="Share workspace" className="h-full overflow-auto">
      <header className="workspace-panel-heading">
        <h2 tabIndex={-1}>Share workspace</h2>
        <Button intent="plain" onPress={onClose}>
          Close ×
        </Button>
      </header>
      <div className="p-5 space-y-5 text-sm">
        <p>
          Anyone with this link can join the workspace as a guest. Guests use
          the same canvas, documents, inbox and agent controls as members,
          including editing and sending replies. They cannot open the admin
          panel.
        </p>
        {localOnly && (
          <p className="text-muted-fg">
            This local link works only on this computer. Share it with others
            after the app has an HTTPS address.
          </p>
        )}
        {status.failed && <p role="alert">Share status unavailable.</p>}
        {!status.data && !status.failed && <p role="status">Loading…</p>}
        {status.data && (
          <p role="status">
            {status.data.active ? "A guest link is active." : "No active link."}
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {url && status.data?.active && (
          <div className="space-y-2">
            <p className="font-medium">Guest link</p>
            <p className="break-all rounded border border-border bg-background p-3">
              {url}
            </p>
            <Button
              intent="outline"
              onPress={async () => {
                if (!(await copy(url))) setError("Could not copy the link.");
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        )}
        {status.data?.active && !url && (
          <p className="text-muted-fg">
            The current link was shown only when created. Generate a new link to
            copy one now; the old link will stop working.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            isDisabled={paused || busy || !status.data || status.failed}
            onPress={async () => {
              setBusy(true);
              setError(undefined);
              try {
                setToken(await create({ workspaceId }));
              } catch {
                setError("Could not create a share link.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {status.data?.active ? "Generate new link" : "Create guest link"}
          </Button>
          {status.data?.active && (
            <Button
              intent="outline"
              isDisabled={paused || busy || status.failed}
              onPress={async () => {
                setBusy(true);
                setError(undefined);
                try {
                  await revoke({ workspaceId });
                  setToken(undefined);
                } catch {
                  setError("Could not revoke the share link.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Revoke link
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
