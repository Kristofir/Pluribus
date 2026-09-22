import { useState, useCallback, useRef, useEffect } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useConvex, useConvexAuth } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { Button } from "@/components/ui/Button";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import CanvasPage from "../canvas/CanvasPage";
import { DocumentRecoveryProvider } from "../documents/DocumentRecoveryProvider";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { WorkspaceTools } from "./WorkspaceTools";
import { WorkspaceShare } from "./WorkspaceShare";
import { DocumentParagraphLink } from "./DocumentParagraphLink";
import { ChatOverlay } from "../chat/ChatOverlay";
const route = getRouteApi("/workspaces/$workspaceId");
export default function WorkspaceRoute() {
  const { workspaceId } = route.useParams(),
    auth = useConvexAuth(),
    navigate = useNavigate();
  const current = useRetainedQuery(
    api.Users.current,
    auth.isAuthenticated ? {} : "skip",
  );
  const back = (
    <Button
      intent="outline"
      onPress={() => void navigate({ to: "/", search: {} })}
    >
      Return to dashboard
    </Button>
  );
  if (auth.isLoading)
    return (
      <main className="workspace-dashboard">
        <p role="status">Loading account…</p>
      </main>
    );
  if (!auth.isAuthenticated)
    return (
      <main className="workspace-dashboard">
        <header className="workspace-page-heading">
          <div>
            <p className="workspace-eyebrow">Workspace access</p>
            <h1>Sign in to open this workspace</h1>
          </div>
        </header>
        <p className="my-4">Use Google sign-in on the dashboard.</p>
        {back}
      </main>
    );
  if (!current.data)
    return (
      <main className="workspace-dashboard">
        <p role={current.failed || current.data === null ? "alert" : "status"}>
          {current.failed || current.data === null
            ? "Your account could not be loaded. Return to the dashboard to check your sign-in."
            : "Loading account…"}
        </p>
        {back}
      </main>
    );
  return (
    <DocumentRecoveryProvider key={`${workspaceId}:${current.data.id}`}>
      <WorkspaceSession
        workspaceId={workspaceId as Id<"workspaces">}
        accountPaused={current.failed}
      />
    </DocumentRecoveryProvider>
  );
}
function WorkspaceSession({
  workspaceId,
  accountPaused,
}: {
  workspaceId: Id<"workspaces">;
  accountPaused: boolean;
}) {
  const view = useRetainedQuery(api.Workspaces.open, { workspaceId }),
    links = useRetainedQuery(api.Documents.links, { workspaceId }),
    access = useRetainedQuery(api.Workspaces.access, { workspaceId });
  const navigate = useNavigate(),
    client = useConvex();
  const [panelOpen, setPanelOpen] = useState(false),
    [shareOpen, setShareOpen] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const openRequest = useRef(0);
  useEffect(
    () => () => {
      openRequest.current++;
    },
    [],
  );
  const onSelection = useCallback(
    (ids: string[]) =>
      setSelection((previous) =>
        previous.length === ids.length &&
        previous.every((id, index) => id === ids[index])
          ? previous
          : ids,
      ),
    [],
  );
  const back = () => void navigate({ to: "/", search: {} });
  if (access.data !== true)
    return (
      <main className="workspace-dashboard">
        <p role={access.data === false || access.failed ? "alert" : "status"}>
          {access.data === false
            ? "Your access to this workspace has ended."
            : access.failed
              ? "Could not verify your workspace access."
              : "Checking workspace access…"}
        </p>
        <Button onPress={back} intent="outline">
          Return to dashboard
        </Button>
      </main>
    );
  if (!view.data)
    return (
      <main className="workspace-dashboard">
        <p role={view.failed ? "alert" : "status"}>
          {view.failed
            ? "This workspace is unavailable or your access has changed."
            : "Opening workspace…"}
        </p>
        <Button onPress={back} intent="outline">
          Return to dashboard
        </Button>
      </main>
    );
  const w = view.data,
    paused = view.failed || accountPaused;
  const show = () => {
    openRequest.current++;
    setShareOpen(false);
    setPanelOpen(true);
  };
  const close = () => {
    openRequest.current++;
    setPanelOpen(false);
  };
  const openParagraph = async (reference: {
    documentId: string;
    paragraphId: string;
  }) => {
    const request = ++openRequest.current;
    setNotice("Opening linked paragraph…");
    try {
      const documentId = reference.documentId as Id<"documents">;
      const target = await client.query(api.Documents.resolveParagraph, {
        documentId,
        paragraphId: reference.paragraphId,
      });
      if (request !== openRequest.current) return;
      if (!target) {
        setNotice(
          "This paragraph was removed. The link does not point to a replacement.",
        );
        return;
      }
      const descriptor = await client.query(api.Documents.describe, {
        documentId,
      });
      if (request !== openRequest.current) return;
      if (descriptor.role === "card") {
        setNotice(
          "This link targets a canvas document. Open that card on the canvas; its editor is kept there.",
        );
        return;
      }
      if (descriptor.role === "main") {
        setNotice("This link targets a retired main document.");
        return;
      }
      setNotice("This link targets a retired reply document.");
    } catch {
      if (request === openRequest.current)
        setNotice(
          "The paragraph could not be opened. Your access or its document may have changed.",
        );
    }
  };
  const selectedLinks =
    links.data?.filter((link) => selection.includes(link.elementId)) ?? [];
  return (
    <WorkspaceLayout
      name={w.name}
      canvas={
        <div className="workspace-canvas-stack">
          <CanvasPage
            workspaceId={workspaceId}
            onSelectionChange={onSelection}
          />
          <ChatOverlay workspaceId={workspaceId} paused={paused} />
        </div>
      }
      panelOpen={panelOpen}
      onDashboard={back}
      onTools={show}
      shareOpen={shareOpen}
      onShare={() => setShareOpen((open) => !open)}
      onCloseShare={() => setShareOpen(false)}
      share={
        shareOpen && (
          <WorkspaceShare workspaceId={workspaceId} paused={paused} />
        )
      }
      notice={
        paused || notice || selectedLinks.length > 0 || links.failed ? (
          <div className="space-y-1">
            {paused && (
              <p role="alert">
                Workspace updates unavailable. Open editors and local text are
                retained.
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
            {links.failed && <p role="status">Paragraph links unavailable.</p>}
            {!paused &&
              !links.failed &&
              selectedLinks.map((link) => (
                <DocumentParagraphLink
                  key={`${link.elementId}:${link.documentId}:${link.paragraphId}`}
                  reference={link}
                  label="Open linked paragraph"
                  onOpen={(reference) => void openParagraph(reference)}
                />
              ))}
          </div>
        ) : undefined
      }
      panel={
        <WorkspaceTools
          workspaceId={workspaceId}
          onClose={close}
          paused={paused}
        />
      }
    />
  );
}
