import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Id } from "@pluribus/backend/dataModel";
import { CollaborativeEditor } from "../documents/CollaborativeEditor";
import { ReplyReview } from "../inbox/ReplyReview";
import type { SelectedPassage } from "../agentAccess/AgentAccessControls";
import { MainDocumentPanel } from "./MainDocumentPanel";
import { DocumentParagraphTools } from "./DocumentParagraphTools";

export type PanelDocument = {
  documentId: Id<"documents">;
  generation: number;
  title: string;
  kind: "main" | "reply";
  threadId?: Id<"inboxThreads">;
};
/** One mounted editor per canonical document; panel navigation only changes visibility. */
export function DocumentPanelSession({
  document: doc,
  workspaceId,
  active,
  paused,
  selected,
  passages,
  onSelect,
  onClose,
  reveal,
  presentation = "panel",
  onRevealTarget,
}: {
  document: PanelDocument;
  presentation?: "panel" | "canvas";
  onRevealTarget?: (target: HTMLElement) => void;
  workspaceId: Id<"workspaces">;
  active: boolean;
  paused: boolean;
  selected: string[];
  passages: SelectedPassage[];
  onSelect: (p: SelectedPassage, included: boolean) => void;
  onClose: () => void;
  reveal?: { paragraphId: string; nonce: number };
}) {
  const [pending, setPending] = useState(false),
    [focused, setFocused] = useState(false);
  const [targetNotice, setTargetNotice] = useState<string>();
  const host = useRef<HTMLDivElement>(null);
  const revealScope = useId();
  const [highlightedParagraph, setHighlightedParagraph] = useState<string>();
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(
    null,
  );
  const reportPending = useCallback((value: boolean) => setPending(value), []);
  useEffect(() => {
    if (!active || !reveal || !host.current) return;
    const root = host.current;
    let highlighted: HTMLElement | null = null;
    setTargetNotice("Locating linked paragraph…");
    const find = () => {
      const target = root.querySelector<HTMLElement>(
        `[data-paragraph-id="${CSS.escape(reveal.paragraphId)}"]`,
      );
      if (!target) return false;
      highlighted = target;
      setHighlightedParagraph(reveal.paragraphId);
      if (onRevealTarget) onRevealTarget(target);
      else target.scrollIntoView({ block: "center", behavior: "auto" });
      setTargetNotice("Linked paragraph highlighted.");
      return true;
    };
    const observer = new MutationObserver(() => {
      if (find()) observer.disconnect();
    });
    if (!find())
      observer.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-paragraph-id"],
      });
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      if (!highlighted)
        setTargetNotice(
          "The linked paragraph is not available in this editor. It may have changed or been removed.",
        );
    }, 5000);
    return () => {
      observer.disconnect();
      clearTimeout(timeout);
      setHighlightedParagraph(undefined);
    };
  }, [active, reveal, onRevealTarget]);
  return (
    <div
      hidden={!active}
      className={
        presentation === "canvas"
          ? "workspace-paper-session"
          : "workspace-panel-session"
      }
      onFocusCapture={(event) =>
        setFocused(
          event.target instanceof Element &&
            !!event.target.closest(
              ".document-paper, .document-formatting-toolbar",
            ),
        )
      }
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        setFocused(
          next instanceof Element &&
            event.currentTarget.contains(next) &&
            !!next.closest(".document-paper, .document-formatting-toolbar"),
        );
      }}
    >
      <MainDocumentPanel
        presentation={presentation}
        title={doc.title}
        kind={doc.kind}
        onClose={onClose}
        targetNotice={targetNotice}
        toolbar={
          <div ref={setToolbarTarget} className="workspace-document-toolbar" />
        }
        status={
          paused
            ? "Workspace access unavailable — editing paused; local text retained."
            : undefined
        }
      >
        {highlightedParagraph && (
          <style>{`#${CSS.escape(revealScope)} [data-paragraph-id="${CSS.escape(highlightedParagraph)}"] { outline: 2px solid var(--ring); outline-offset: 4px; border-radius: 3px; }`}</style>
        )}
        <div ref={host} id={revealScope} className="document-writing-surface">
          <CollaborativeEditor
            id={doc.documentId}
            generation={doc.generation}
            embedded
            presentation="document"
            toolbarTarget={toolbarTarget}
            participate={active && focused && !paused}
            interactionEnabled={active && !paused}
            paused={paused}
            onPendingChange={reportPending}
          />
        </div>
        <div className="workspace-document-secondary">
          <DocumentParagraphTools
            workspaceId={workspaceId}
            documentId={doc.documentId}
            selected={selected}
            passages={passages}
            onSelect={onSelect}
            pending={pending}
            paused={paused || !active}
          />
          {doc.threadId && (
            <ReplyReview
              threadId={doc.threadId}
              pending={pending}
              paused={paused || !active}
            />
          )}
        </div>
      </MainDocumentPanel>
    </div>
  );
}
