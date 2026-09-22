import { useCardEntrance } from "../../hooks/UseCardEntrance";
import { memo, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { geometryLimits } from "@pluribus/core/canvas/domain";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { Id } from "@pluribus/backend/dataModel";
import { CollaborativeEditor } from "../documents/CollaborativeEditor";
import "../documents/Documents.css";
import { useDocumentInteraction } from "./UseDocumentInteraction";
export type DocumentNode = Node<
  {
    documentId: Id<"documents">;
    generation: number;
    removed: boolean;
    editable: boolean;
    readPaused: boolean;
    editing: boolean;
    activate: (active: boolean) => void;
    pending: (value: boolean) => void;
    contentHeight: (height: number) => void;
  },
  "document"
>;
/** Geometry preserves editor identity; a restored generation always opens a fresh editor. */
export const DocumentCard = memo(function DocumentCard({
  data,
  height,
}: NodeProps<DocumentNode>) {
  const entrance = useCardEntrance();
  const card = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const interaction = useDocumentInteraction(card, data);
  const [minimumHeight, setMinimumHeight] = useState(
    geometryLimits.minSize as number,
  );
  const [authorTooltip, setAuthorTooltip] = useState<{
    label: string;
    x: number;
    y: number;
    above: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    const element = body.current;
    const container = card.current;
    if (!element || !container) return;
    const measure = () => {
      // Wait for the editor, so loading placeholders do not determine persisted size.
      if (!element.querySelector(".tiptap")) return;
      const style = getComputedStyle(container);
      const inset =
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom) +
        parseFloat(style.borderTopWidth) +
        parseFloat(style.borderBottomWidth);
      const minimum = Math.max(
        geometryLimits.minSize,
        Math.ceil(element.offsetHeight + inset),
      );
      setMinimumHeight(minimum);
      data.contentHeight(minimum);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [data.contentHeight, data.editable, height]);
  return (
    <>
      <section
        style={entrance}
        ref={card}
        data-document-id={data.documentId}
        className={`canvas-card canvas-document document-drag-handle${data.editing ? " is-editing" : ""}`}
        onPointerDown={interaction.onPointerDown}
        onClick={interaction.onClick}
        onKeyDownCapture={(event) => {
          if (
            event.key === "Escape" &&
            data.editing &&
            !(
              event.target instanceof Element &&
              event.target.closest(".selection-formatting-menu")
            ) &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            event.stopPropagation();
            data.activate(false);
            card.current
              ?.closest<HTMLElement>(".react-flow__node")
              ?.focus({ preventScroll: true });
          }
        }}
      >
        <NodeResizer
          isVisible={data.editable}
          minWidth={300}
          minHeight={minimumHeight}
          maxWidth={geometryLimits.maxSize}
        />
        <div
          className={`document-card-content${data.editing ? " nodrag nopan" : ""}`}
        >
          <div
            ref={body}
            className="document-card-body"
            onPointerMove={(event) => {
              const span =
                event.target instanceof Element
                  ? event.target.closest<HTMLElement>(
                      ".author-text, .author-text-own",
                    )
                  : null;
              const label = span?.dataset.authorLabel;
              if (!span || !label || !body.current?.contains(span)) {
                setAuthorTooltip(null);
                return;
              }
              const rect = span.getBoundingClientRect();
              const above = rect.top >= 40;
              const next = {
                label,
                x: Math.max(8, Math.min(rect.left, window.innerWidth - 228)),
                y: above ? rect.top - 8 : rect.bottom + 8,
                above,
              };
              setAuthorTooltip((previous) =>
                previous?.label === next.label &&
                previous.x === next.x &&
                previous.y === next.y &&
                previous.above === next.above
                  ? previous
                  : next,
              );
            }}
            onPointerLeave={() => setAuthorTooltip(null)}
          >
            <CollaborativeEditor
              key={data.generation}
              embedded
              presentation="card"
              interactionEnabled={data.editing && data.editable}
              focusPoint={interaction.focusPoint}
              id={data.documentId}
              generation={data.generation}
              participate={data.editing && data.editable}
              paused={data.readPaused}
              onPendingChange={data.pending}
            />
          </div>
        </div>
      </section>
      {authorTooltip &&
        createPortal(
          <div
            role="tooltip"
            className="document-author-tooltip"
            style={{
              left: authorTooltip.x,
              top: authorTooltip.y,
              transform: authorTooltip.above ? "translateY(-100%)" : undefined,
            }}
          >
            {authorTooltip.label}
          </div>,
          document.body,
        )}
    </>
  );
});
