import { geometryLimits } from "@pluribus/core/canvas/domain";
import { useState } from "react";
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
    restore: () => void;
  },
  "document"
>;
/** The node stays mounted through geometry and lifecycle changes, retaining rejected local work. */
export function DocumentCard({ data, selected }: NodeProps<DocumentNode>) {
  const [generation, setGeneration] = useState(data.generation);
  const [discarded, setDiscarded] = useState(false);
  const expired = generation !== data.generation;
  return (
    <section className={`canvas-document ${data.removed ? "is-removed" : ""}`}>
      <NodeResizer
        isVisible={selected && data.editable && !data.removed}
        minWidth={360}
        minHeight={280}
        maxWidth={geometryLimits.maxSize}
        maxHeight={geometryLimits.maxSize}
      />
      <header
        className="document-drag-handle"
        tabIndex={0}
        onPointerDown={(event) => {
          event.currentTarget.focus();
          data.activate(false);
        }}
      >
        {data.removed ? "Removed document" : "Document"}
        {data.removed && (
          <button className="nodrag" onClick={data.restore}>
            Restore
          </button>
        )}
      </header>
      <div
        className="document-card-content nodrag nowheel nopan"
        onPointerDown={() => data.activate(true)}
        onFocusCapture={() => data.activate(true)}
      >
        {!discarded && (
          <CollaborativeEditor
            key={generation}
            embedded
            id={data.documentId}
            generation={generation}
            participate={data.editing && !data.removed && !expired}
            suspended={data.removed || expired}
            paused={!data.editable}
            onPendingChange={data.pending}
          />
        )}
        {(data.removed || expired) && !discarded && (
          <button
            onClick={() => {
              data.pending(false);
              setDiscarded(true);
            }}
          >
            Discard local recovery
          </button>
        )}
        {!data.removed && (expired || discarded) && (
          <button
            onClick={() => {
              setGeneration(data.generation);
              setDiscarded(false);
              data.pending(false);
            }}
          >
            Open restored document (discard local recovery)
          </button>
        )}
      </div>
    </section>
  );
}
