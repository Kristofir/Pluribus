import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import "./Workspace.css";

/** Composition only: callers retain editor mounts and own workspace subscriptions. */
export function WorkspaceLayout({
  name,
  account,
  canvas,
  panel,
  panelOpen,
  panelReturnFocus = "mainDocument",
  panelFocusKey,
  onDashboard,
  onMainDocument,
  onInbox,
  onTools,
  onShare,
  notice,
}: {
  name: string;
  account?: ReactNode;
  canvas: ReactNode;
  panel: ReactNode;
  panelOpen: boolean;
  panelFocusKey?: string;
  /** Fallback for direct links or an opener removed when switching surfaces. */
  panelReturnFocus?: "mainDocument" | "inbox" | "tools" | "share";
  onDashboard: () => void;
  onMainDocument: () => void;
  onInbox: () => void;
  onTools?: () => void;
  onShare?: () => void;
  notice?: ReactNode;
}) {
  const panelHost = useRef<HTMLDivElement>(null);
  const previousFocusKey = useRef(panelFocusKey);
  const previousOpen = useRef(false);
  const previousReturnFocus = useRef(panelReturnFocus);
  const mainTrigger = useRef<HTMLButtonElement>(null);
  const inboxTrigger = useRef<HTMLButtonElement>(null);
  const toolsTrigger = useRef<HTMLButtonElement>(null);
  const shareTrigger = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const fallback =
      panelReturnFocus === "share"
        ? shareTrigger.current
        : panelReturnFocus === "tools"
          ? toolsTrigger.current
          : panelReturnFocus === "inbox"
            ? inboxTrigger.current
            : mainTrigger.current;
    const canReturnTo = (element: HTMLElement | null) =>
      !!element?.isConnected &&
      !panelHost.current?.contains(element) &&
      element.getClientRects().length > 0 &&
      element.matches(
        "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
      );
    if (panelOpen && !previousOpen.current) {
      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      opener.current = canReturnTo(active) ? active : fallback;
      // Narrow screens replace the visible canvas; desktop keeps both surfaces available.
      if (window.matchMedia("(max-width: 760px)").matches)
        Array.from(panelHost.current?.querySelectorAll<HTMLElement>("h2") ?? [])
          .find((heading) => heading.getClientRects().length > 0)
          ?.focus();
    } else if (panelOpen && previousReturnFocus.current !== panelReturnFocus) {
      opener.current = fallback;
    } else if (!panelOpen && previousOpen.current) {
      (canReturnTo(opener.current) ? opener.current : fallback)?.focus({
        preventScroll: true,
      });
    }
    if (
      panelOpen &&
      previousFocusKey.current !== panelFocusKey &&
      window.matchMedia("(max-width: 760px)").matches
    )
      Array.from(panelHost.current?.querySelectorAll<HTMLElement>("h2") ?? [])
        .find((heading) => heading.getClientRects().length > 0)
        ?.focus();
    previousFocusKey.current = panelFocusKey;
    previousOpen.current = panelOpen;
    previousReturnFocus.current = panelReturnFocus;
  }, [panelOpen, panelReturnFocus, panelFocusKey]);
  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <div className="workspace-identity">
          <Button intent="plain" size="sm" onPress={onDashboard}>
            ← Workspaces
          </Button>
          <span className="workspace-divider" />
          <h1>{name}</h1>
        </div>
        <nav aria-label="Workspace surfaces" className="workspace-actions">
          <Button
            ref={mainTrigger}
            intent="outline"
            onPress={() => {
              opener.current = mainTrigger.current;
              onMainDocument();
            }}
          >
            Main document
          </Button>
          <Button
            ref={inboxTrigger}
            intent="outline"
            onPress={() => {
              opener.current = inboxTrigger.current;
              onInbox();
            }}
          >
            Inbox
          </Button>
          {onTools && (
            <Button
              ref={toolsTrigger}
              intent="outline"
              onPress={() => {
                opener.current = toolsTrigger.current;
                onTools();
              }}
            >
              Agents
            </Button>
          )}
          {onShare && (
            <Button
              ref={shareTrigger}
              intent="outline"
              onPress={() => {
                opener.current = shareTrigger.current;
                onShare();
              }}
            >
              Share
            </Button>
          )}
          {account}
        </nav>
      </header>
      {notice && <div className="workspace-notice">{notice}</div>}
      <div className={`workspace-body${panelOpen ? " has-panel" : ""}`}>
        <section className="workspace-canvas" aria-label="Workspace canvas">
          {canvas}
        </section>
        <div
          ref={panelHost}
          className="workspace-panel-host"
          hidden={!panelOpen}
        >
          {panel}
        </div>
      </div>
    </main>
  );
}
