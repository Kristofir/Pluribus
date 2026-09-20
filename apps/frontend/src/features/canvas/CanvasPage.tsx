import { documentDragThreshold } from "./DocumentPress";
import { ThemePicker } from "../../components/ThemePicker";
import { memo, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { InteractionEvent } from "@pluribus/core/presence/domain";
import { usePresence } from "../presence/UsePresence";
import { PresenceRoster } from "../presence/PresenceRoster";
import { AlignmentGuides } from "./AlignmentGuides";
import { CanvasPresence } from "./CanvasPresence";
import { Link } from "@tanstack/react-router";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type CoordinateExtent,
} from "@xyflow/react";
import { rectangleLimits, geometryLimits } from "@pluribus/core/canvas/domain";
import { DocumentCard } from "./DocumentNode";
import type { CanvasNode } from "./UseCanvas";
import { Rectangle } from "./RectangleNode";
import { useCanvas } from "./UseCanvas";
import "@xyflow/react/dist/style.css";
import "./Canvas.css";
const nodeTypes = { rectangle: Rectangle, document: DocumentCard };

const emptyEdges: Edge[] = [];
const nodeExtent: CoordinateExtent = [
  [-geometryLimits.maxCoordinate, -geometryLimits.maxCoordinate],
  [geometryLimits.maxCoordinate, geometryLimits.maxCoordinate],
];
function Canvas() {
  const presence = usePresence({ kind: "canvas", id: "shared" }, true);
  const roster = useMemo(
    () => <PresenceRoster presence={presence} />,
    [
      presence.members,
      presence.identity,
      presence.show,
      presence.toggle,
      presence.error,
    ],
  );
  return (
    <CanvasScene
      emit={presence.emit}
      presenceId={presence.id}
      roster={roster}
    />
  );
}
const CanvasScene = memo(function CanvasScene({
  emit,
  presenceId,
  roster,
}: {
  emit: (event: InteractionEvent) => void;
  presenceId: string | null;
  roster: ReactNode;
}) {
  const flow = useReactFlow();
  const {
    nodes,
    alignmentGuides,
    onNodesChange,
    addRectangle,
    addDocument,
    documentCount,
    stopEditing,
    deleteSelection,
    history,
    pending,
    undoElement,
    redoElement,
    connected,
    selected,
    store,
    queryFailed,

    surface,
  } = useCanvas(emit);
  useEffect(() => {
    emit({ type: "selection-changed", elements: [...selected] });
  }, [selected, emit, presenceId]);
  const onNodeClick = useCallback(
    (_: unknown, node: CanvasNode) => {
      if (node.type !== "document") stopEditing();
    },
    [stopEditing],
  );
  return (
    <main
      className="canvas"
      tabIndex={-1}
      onPointerDownCapture={(event) => {
        if (
          event.target instanceof HTMLElement &&
          !event.target.closest("input, textarea, [contenteditable=true]")
        )
          event.currentTarget.focus({ preventScroll: true });
      }}
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          (event.target instanceof HTMLElement &&
            event.target.closest("input, textarea, [contenteditable=true]"))
        )
          return;
        if (
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")
        ) {
          event.preventDefault();
          if (event.shiftKey || event.key.toLowerCase() === "y")
            void redoElement();
          else void undoElement();
          return;
        }
        if (
          (event.key === "Delete" || event.key === "Backspace") &&
          !(
            event.target instanceof HTMLElement &&
            event.target.closest("input, textarea, [contenteditable=true]")
          )
        ) {
          event.preventDefault();
          void deleteSelection();
        }
      }}
    >
      <CanvasToolbar
        store={store}
        connected={connected}
        nodeCount={nodes.length}
        documentCount={documentCount}
        addRectangle={addRectangle}
        addDocument={addDocument}
        deleteSelection={deleteSelection}
      />
      <ElementHistoryControls
        history={history}
        connected={connected && pending === 0}
        undo={undoElement}
        redo={redoElement}
      />
      {roster}
      <CanvasError store={store} queryFailed={queryFailed} />
      <div
        ref={surface}
        className="canvas-surface"
        onPointerMove={(event) =>
          emit({
            type: "pointer-moved",
            point: flow.screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            }),
          })
        }
        onPointerLeave={() => emit({ type: "pointer-left" })}
      >
        <ReactFlow<CanvasNode>
          nodes={nodes}
          onPaneClick={stopEditing}
          onNodeClick={onNodeClick}
          onNodeDragStart={stopEditing}
          onlyRenderVisibleElements={false}
          edges={emptyEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          nodeDragThreshold={documentDragThreshold}
          nodeClickDistance={documentDragThreshold}
          nodesDraggable={connected}
          nodesConnectable={false}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          deleteKeyCode={null}
          minZoom={0.1}
          maxZoom={3}
          nodeExtent={nodeExtent}
        >
          <CanvasActivity nodes={nodes} />
          <AlignmentGuides guides={alignmentGuides} />
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </main>
  );
});

type CanvasStore = ReturnType<typeof useCanvas>["store"];
const CanvasToolbar = memo(function CanvasToolbar({
  store,
  connected,
  nodeCount,
  documentCount,
  addRectangle,
  addDocument,
  deleteSelection,
}: {
  store: CanvasStore;
  connected: boolean;
  nodeCount: number;
  documentCount: number;
  addRectangle: () => Promise<void>;
  addDocument: () => Promise<void>;
  deleteSelection: () => Promise<void>;
}) {
  const { creating, selected, removing } = useStore(
    store,
    useShallow(({ creating, selected, removing }) => ({
      creating,
      selected,
      removing,
    })),
  );
  return (
    <header className="canvas-toolbar">
      <Link to="/" search={{}}>
        Home
      </Link>
      <h1>Shared canvas</h1>
      <ThemePicker />
      <button
        onClick={() => void addRectangle()}
        disabled={
          !connected || creating || nodeCount >= rectangleLimits.maxCount
        }
      >
        Add rectangle
      </button>
      <button
        onClick={() => void addDocument()}
        disabled={!connected || creating || documentCount >= 2}
      >
        Add document
      </button>
      <button
        onClick={() => void deleteSelection()}
        disabled={!connected || !selected.size || !!removing.size}
      >
        Delete selected
      </button>
      {!connected && <span role="status">Disconnected — editing paused</span>}
    </header>
  );
});
function ElementHistoryControls({
  history,
  connected,
  undo,
  redo,
}: {
  history: ReturnType<typeof useCanvas>["history"];
  connected: boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}) {
  const state = useStore(history.store);
  return (
    <div className="canvas-history" aria-label="Element history">
      <button
        onClick={() => void undo()}
        disabled={
          !connected || state.busy || !!state.retry || !state.undo.length
        }
      >
        Undo
      </button>
      <button
        onClick={() => void redo()}
        disabled={
          !connected || state.busy || !!state.retry || !state.redo.length
        }
      >
        Redo
      </button>
      {state.error && <span role="alert">{state.error}</span>}
      {state.retry && (
        <button
          disabled={!connected || state.busy}
          onClick={() => void history.retry()}
        >
          Retry action
        </button>
      )}
    </div>
  );
}
function CanvasError({
  store,
  queryFailed,
}: {
  store: CanvasStore;
  queryFailed: boolean;
}) {
  const error = useStore(store, (state) => state.error);
  const message = queryFailed
    ? "Canvas updates unavailable — editing paused. Keep this tab open to preserve unsaved text."
    : error;
  return message ? (
    <p role="alert" className="canvas-error">
      {message}
    </p>
  ) : null;
}
const CanvasActivity = memo(function CanvasActivity({
  nodes,
}: {
  nodes: CanvasNode[];
}) {
  const presence = usePresence({ kind: "canvas", id: "shared" }, true);
  return <CanvasPresence presence={presence} nodes={nodes} />;
});

export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
