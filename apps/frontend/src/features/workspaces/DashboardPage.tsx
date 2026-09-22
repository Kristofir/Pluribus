import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import "./Workspace.css";
export type WorkspaceSummary = { id: string; name: string; canvasId: string };
export function DashboardPage({
  workspaces,
  loading,
  signedOut = false,
  error,
  account,
  onOpen,
  onRetry,
}: {
  workspaces: readonly WorkspaceSummary[];
  loading: boolean;
  signedOut?: boolean;
  error?: string;
  account?: ReactNode;
  onOpen: (workspace: WorkspaceSummary) => void;
  onRetry?: () => void;
}) {
  return (
    <main className="workspace-dashboard">
      <header className="workspace-page-heading">
        <div>
          <p className="workspace-eyebrow">Your shared spaces</p>
          <h1>Workspaces</h1>
          <p>Bring your documents, sources and conversations together.</p>
        </div>
        {account}
      </header>
      {error ? (
        <div role="alert" className="workspace-empty">
          <h2>Workspaces unavailable</h2>
          <p>{error}</p>
          {onRetry && (
            <Button intent="outline" onPress={onRetry}>
              Try again
            </Button>
          )}
        </div>
      ) : loading ? (
        <p role="status" className="workspace-empty">
          Loading your workspaces…
        </p>
      ) : signedOut ? (
        <div className="workspace-empty">
          <h2>Sign in to your workspaces</h2>
          <p>Use Google sign-in above to see the workspaces assigned to you.</p>
        </div>
      ) : workspaces.length === 0 ? (
        <div className="workspace-empty">
          <h2>No workspaces assigned yet</h2>
          <p>
            Your account is ready. A demo organizer can give you access to a
            workspace.
          </p>
        </div>
      ) : (
        <div className="workspace-grid">
          {workspaces.map((workspace) => (
            <Card key={workspace.id}>
              <CardHeader>
                <p className="workspace-eyebrow">Shared workspace</p>
                <h2>{workspace.name}</h2>
              </CardHeader>
              <CardContent>
                <p className="text-muted-fg mb-6">Canvas · Documents · Inbox</p>
                <Button
                  onPress={() => onOpen(workspace)}
                  aria-label={`Open ${workspace.name}`}
                >
                  Open workspace →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
