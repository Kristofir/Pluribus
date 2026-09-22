import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import "./Workspace.css";

/** Keep this dock mounted when hiding it; the reply editor owns its text. */
export function ReplyDocumentPanel({
  title,
  children,
  onClose,
  status,
  targetNotice,
  actions,
  toolbar,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  status?: ReactNode;
  targetNotice?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
}) {
  const heading = useId();
  return (
    <aside className="workspace-document-panel" aria-labelledby={heading}>
      <header className="workspace-panel-heading">
        <div>
          <p className="workspace-eyebrow">Collaborative reply</p>
          <h2 id={heading} tabIndex={-1}>
            {title}
          </h2>
        </div>
        <Button
          intent="plain"
          size="sm"
          onPress={onClose}
          aria-label="Close reply panel"
        >
          Close ×
        </Button>
      </header>
      {status && (
        <div className="workspace-panel-status" role="status">
          {status}
        </div>
      )}
      {targetNotice && (
        <p role="status" className="workspace-notice">
          {targetNotice}
        </p>
      )}
      {toolbar}
      <div className="workspace-document-scroll">{children}</div>
      {actions && <footer className="workspace-panel-footer">{actions}</footer>}
    </aside>
  );
}
