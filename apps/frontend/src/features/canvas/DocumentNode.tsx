import { memo, useLayoutEffect, useRef, useState } from "react";
import { geometryLimits } from "@pluribus/core/canvas/domain";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { Id } from "@pluribus/backend/dataModel";
import { CollaborativeEditor } from "../documents/CollaborativeEditor";
import "../documents/Documents.css";
export type DocumentNode = Node<
  {
    documentId: Id<"documents">;
    generation: number;
    removed: boolean;
    editable: boolean;
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
  selected,
  height,
}: NodeProps<DocumentNode>) {
  const card = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [minimumHeight, setMinimumHeight] = useState(
    geometryLimits.minSize as number,
  );
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
    <section
      ref={card}
      className="canvas-document document-drag-handle"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) data.activate(false);
      }}
    >
      <NodeResizer
        isVisible={selected && data.editable}
        minWidth={360}
        minHeight={minimumHeight}
        maxWidth={geometryLimits.maxSize}
      />
      <div
        className="document-card-content nodrag nowheel nopan"
        onPointerDown={() => data.activate(true)}
        onFocusCapture={() => data.activate(true)}
      >
        <div ref={body} className="document-card-body">
          <CollaborativeEditor
            key={data.generation}
            embedded
            id={data.documentId}
            generation={data.generation}
            participate={data.editing && data.editable}
            paused={!data.editable}
            onPendingChange={data.pending}
          />
        </div>
      </div>
    </section>
  );
});
