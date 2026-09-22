import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { Button } from "@/components/ui/Button";
import { useClipboard } from "../../hooks/UseClipboard";

export function WorkspaceShare({
  workspaceId,
  paused,
}: {
  workspaceId: Id<"workspaces">;
  paused: boolean;
}) {
  const ensure = useMutation(api.ShareLinks.ensure);
  const [token, setToken] = useState<string>();
  const [error, setError] = useState(false);
  const { copy, copied } = useClipboard();
  useEffect(() => {
    let active = true;
    if (!paused) {
      void ensure({ workspaceId }).then(
        (value) => {
          if (active) setToken(value);
        },
        () => {
          if (active) setError(true);
        },
      );
    }
    return () => {
      active = false;
    };
  }, [ensure, paused, workspaceId]);
  const url = token ? `${window.location.origin}/share#${token}` : "";
  return (
    <div
      role="dialog"
      aria-label="Share workspace"
      className="workspace-share-content"
    >
      <input
        aria-label="Workspace link"
        readOnly
        value={url}
        placeholder="Loading link…"
        onFocus={(event) => event.currentTarget.select()}
      />
      <Button intent="outline" isDisabled={!url} onPress={() => void copy(url)}>
        {copied ? "Copied" : "Copy"}
      </Button>
      {(error || paused) && <p role="alert">Link unavailable.</p>}
    </div>
  );
}
