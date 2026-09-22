import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import "./Workspace.css";
/** Nonmodal dock. Keep this component mounted when hiding it; editor owns text. */
export function MainDocumentPanel({
  title,
  kind = "main",
  children,
  onClose,
  status,
  targetNotice,
  actions,
  toolbar,
  presentation = "panel",
}: {
  title: string;
  presentation?: "panel" | "canvas";
  kind?: "main" | "reply";
  children: ReactNode;
  onClose: () => void;
  status?: ReactNode;
  targetNotice?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
}) {
  const heading = useId();
  return (
    <aside
      className={`workspace-document-panel${presentation === "canvas" ? " canvas-paper-document" : ""}`}
      aria-labelledby={heading}
    >
      <header className="workspace-panel-heading">
        <div>
          <p className="workspace-eyebrow">
            {kind === "reply" ? "Collaborative reply" : "Main document"}
          </p>
          <h2 id={heading} tabIndex={-1}>
            {title}
          </h2>
        </div>
        {presentation === "panel" && (
          <Button
            intent="plain"
            size="sm"
            onPress={onClose}
            aria-label={`Close ${kind === "reply" ? "reply" : "main document"} panel`}
          >
            Close ×
          </Button>
        )}
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
