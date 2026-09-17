import { useEffect } from "react";
import { usePresence } from "../presence/UsePresence";
import { PresenceRoster } from "../presence/PresenceRoster";
import { CanvasPresence } from "./CanvasPresence";
import { Link } from "@tanstack/react-router";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { rectangleLimits, geometryLimits } from "@pluribus/core/canvas/domain";
import { DocumentCard } from "./DocumentNode";
import type { CanvasNode } from "./UseCanvas";
import { Rectangle } from "./RectangleNode";
import { useCanvas } from "./UseCanvas";
import "@xyflow/react/dist/style.css";
import "./Canvas.css";
const nodeTypes = { rectangle: Rectangle, document: DocumentCard };

function Canvas() {
  const presence = usePresence({ kind: "canvas", id: "shared" }, true);
  const flow = useReactFlow();
  const {
    nodes,
    onNodesChange,
    addRectangle,
    addDocument,
    documentCount,
    stopEditing,
    deleteSelection,
    connected,
    creating,
    selected,
    removing,
    error,

    surface,
  } = useCanvas(presence.emit);
  useEffect(() => {
    presence.emit({ type: "selection-changed", elements: [...selected] });
  }, [selected, presence.emit, presence.id]);
  return (
    <main
      className="canvas"
      onKeyDown={(event) => {
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
      <header className="canvas-toolbar">
        <Link to="/" search={{}}>
          Home
        </Link>
        <h1>Shared canvas</h1>
        <button
          onClick={() => void addRectangle()}
          disabled={
            !connected || creating || nodes.length >= rectangleLimits.maxCount
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
      <PresenceRoster presence={presence} />
      {error && (
        <p role="alert" className="canvas-error">
          {error}
        </p>
      )}
      <div
        ref={surface}
        className="canvas-surface"
        onPointerMove={(event) =>
          presence.emit({
            type: "pointer-moved",
            point: flow.screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            }),
          })
        }
        onPointerLeave={() => presence.emit({ type: "pointer-left" })}
      >
        <ReactFlow<CanvasNode>
          nodes={nodes}
          onPaneClick={stopEditing}
          onNodeClick={(_, node) => {
            if (node.type !== "document") stopEditing();
          }}
          onNodeDragStart={stopEditing}
          onlyRenderVisibleElements={false}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          nodesDraggable={connected}
          nodesConnectable={false}
          deleteKeyCode={null}
          minZoom={0.1}
          maxZoom={3}
          nodeExtent={[
            [-geometryLimits.maxCoordinate, -geometryLimits.maxCoordinate],
            [geometryLimits.maxCoordinate, geometryLimits.maxCoordinate],
          ]}
        >
          <CanvasPresence presence={presence} nodes={nodes} />
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </main>
  );
}

export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
