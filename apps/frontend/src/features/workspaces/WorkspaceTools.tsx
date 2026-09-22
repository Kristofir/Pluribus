import type { Id } from "@pluribus/backend/dataModel";
import { Button } from "@/components/ui/Button";
import { AgentAccessControls } from "../agentAccess/AgentAccessControls";
export function WorkspaceTools({
  workspaceId,
  onClose,
  paused = false,
}: {
  workspaceId: Id<"workspaces">;
  onClose: () => void;
  paused?: boolean;
}) {
  return (
    <aside aria-label="Agents" className="h-full overflow-auto">
      <header className="workspace-panel-heading">
        <h2 tabIndex={-1}>Agents</h2>
        <Button intent="plain" onPress={onClose}>
          Close ×
        </Button>
      </header>
      <div className="p-5">
        <AgentAccessControls paused={paused} workspaceId={workspaceId} />
      </div>
    </aside>
  );
}
