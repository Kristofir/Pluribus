import { CanvasCreateMenu } from "./CanvasCreateMenu";
import {
  MainPaper,
  MainPaperViewport,
  mainPaperNode,
  mainPaperId,
  type MainPaperNode,
} from "./MainPaperNode";
import { canvasSelection } from "./CanvasSelection";
import { WebPageNodeCard } from "./WebPageNode";
import { WebPageFetching } from "../sources/WebPageFetching";
import { WebPageForm } from "../sources/WebPageForm";
import { WebPageCapturePanel } from "../sources/WebPageCapturePanel";
import { sourceLimits } from "@pluribus/core/sources/domain";
import { documentLimits } from "@pluribus/core/canvas/domain";
import { CanvasScope, useCanvasScope } from "./CanvasScope";
import type { Id } from "@pluribus/backend/dataModel";
import { documentDragThreshold } from "./DocumentPress";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import type { InteractionEvent } from "@pluribus/core/presence/domain";
import { usePresence } from "../presence/UsePresence";
import { PresenceRoster } from "../presence/PresenceRoster";
import { CanvasPresence } from "./CanvasPresence";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type CoordinateExtent,
  type NodeChange,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { geometryLimits } from "@pluribus/core/canvas/domain";
import { DocumentCard } from "./DocumentNode";
import type { CanvasNode } from "./UseCanvas";
import { useCanvas } from "./UseCanvas";
import "@xyflow/react/dist/style.css";
import "./Canvas.css";
type WebPageDraftNode = Node<{ content: ReactNode }, "webPageDraft">;
const webPageDraftId = "local-web-page-draft";
function WebPageDraft({ data }: NodeProps<WebPageDraftNode>) {
  return (
    <section className="web-page-card" aria-label="New web page card">
      {data.content}
    </section>
  );
}
type SceneNode = CanvasNode | MainPaperNode | WebPageDraftNode;
const nodeTypes = {
  document: DocumentCard,
  source: WebPageNodeCard,
  mainPaper: MainPaper,
  webPageDraft: WebPageDraft,
};

const emptyEdges: Edge[] = [];
const nodeExtent: CoordinateExtent = [
  [-geometryLimits.maxCoordinate, -geometryLimits.maxCoordinate],
  [geometryLimits.maxCoordinate, geometryLimits.maxCoordinate],
];
function Canvas() {
  const { workspaceId } = useCanvasScope();
  const presence = usePresence(
    { kind: "canvas", id: workspaceId ?? "shared" },
    true,
  );
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
  const {
    workspaceId,
    onSelectionChange,
    mainPaper,
    paperFocus = 0,
  } = useCanvasScope();
  const flow = useReactFlow();
  const [addingWebPage, setAddingWebPage] = useState<{
    x: number;
    y: number;
    sourceId?: string;
  } | null>(null);
  const [createMenu, setCreateMenu] = useState<{
    screen: { x: number; y: number };
    position: { x: number; y: number };
  } | null>(null);
  const {
    nodes,
    onNodesChange,
    addDocument,
    addWebPage,
    sourceCount,
    openSourceId,
    setOpenSourceId,
    includeSource,
    interactionEnabled,
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
  const creating = useStore(store, (state) => state.creating);
  const openCreateMenu = (screen: { x: number; y: number }) => {
    stopEditing();
    setCreateMenu({ screen, position: flow.screenToFlowPosition(screen) });
  };
  useEffect(() => {
    emit({ type: "selection-changed", elements: [...selected] });
    onSelectionChange?.([...selected]);
  }, [selected, emit, presenceId, onSelectionChange]);
  useEffect(() => {
    if (paperFocus === 0) return;
    const current = store.getState();
    current.setEditing(null);
    current.select(
      [...current.selected].map((id) => ({ id, selected: false })),
    );
  }, [paperFocus, store]);
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: SceneNode) => {
      if (event.shiftKey || node.type !== "document") stopEditing();
      if (node.type === "mainPaper") {
        const current = store.getState();
        current.select(
          [...current.selected].map((id) => ({ id, selected: false })),
        );
      }
    },
    [stopEditing, store],
  );
  const draftReplaced =
    !!addingWebPage?.sourceId &&
    nodes.some((node) => node.id === addingWebPage.sourceId);
  useEffect(() => {
    if (draftReplaced) setAddingWebPage(null);
  }, [draftReplaced]);
  const sceneNodes = useMemo(() => {
    const sceneNodes: SceneNode[] = mainPaper
      ? [mainPaperNode(mainPaper), ...nodes]
      : [...nodes];
    if (addingWebPage && workspaceId && !draftReplaced)
      sceneNodes.push({
        id: webPageDraftId,
        type: "webPageDraft",
        position: addingWebPage,
        width: 300,
        draggable: false,
        selectable: false,
        deletable: false,
        connectable: false,
        zIndex: 1001,
        data: {
          content: (
            <div
              onKeyDown={(event) => {
                event.stopPropagation();
                if (
                  event.key === "Escape" &&
                  !creating &&
                  !addingWebPage.sourceId
                )
                  setAddingWebPage(null);
              }}
            >
              {addingWebPage.sourceId ? (
                <div style={{ height: 144, display: "flex" }}>
                  <WebPageFetching />
                </div>
              ) : (
                <WebPageForm
                  compact
                  disabled={
                    !interactionEnabled || sourceCount >= sourceLimits.maxCount
                  }
                  onSubmit={async (input) => {
                    const sourceId = await addWebPage(input, addingWebPage);
                    setAddingWebPage((current) =>
                      current ? { ...current, sourceId } : null,
                    );
                  }}
                />
              )}
            </div>
          ),
        },
      });
    return sceneNodes;
  }, [
    mainPaper,
    nodes,
    addingWebPage,
    workspaceId,
    draftReplaced,
    creating,
    interactionEnabled,
    sourceCount,
    addWebPage,
  ]);
  const onSceneNodesChange = useCallback(
    (changes: NodeChange<SceneNode>[]) => {
      // Paper measurement/selection is local to React Flow and cannot become an element operation.
      onNodesChange(
        changes.filter((change) =>
          "id" in change
            ? change.id !== mainPaperId && change.id !== webPageDraftId
            : change.item.id !== mainPaperId &&
              change.item.id !== webPageDraftId,
        ) as NodeChange<CanvasNode>[],
      );
    },
    [onNodesChange],
  );
  return (
    <main
      onContextMenuCapture={(event) => event.preventDefault()}
      className={workspaceId ? "canvas canvas-embedded" : "canvas"}
      tabIndex={-1}
      onPointerDownCapture={(event) => {
        if (
          event.target instanceof HTMLElement &&
          !event.target.closest(
            "input, textarea, select, [contenteditable=true]",
          )
        )
          event.currentTarget.focus({ preventScroll: true });
      }}
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          (event.target instanceof HTMLElement &&
            event.target.closest(
              "input, textarea, select, [contenteditable=true]",
            ))
        )
          return;
        if (
          (event.key === "ContextMenu" ||
            (event.shiftKey && event.key === "F10")) &&
          !(
            event.target instanceof Element &&
            event.target.closest(".react-flow__node")
          )
        ) {
          event.preventDefault();
          const bounds = surface.current?.getBoundingClientRect();
          if (bounds)
            openCreateMenu({
              x: bounds.left + bounds.width / 2,
              y: bounds.top + bounds.height / 2,
            });
          return;
        }
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
            event.target.closest(
              "input, textarea, select, [contenteditable=true]",
            )
          )
        ) {
          event.preventDefault();
          void deleteSelection();
        }
      }}
    >
      {createMenu && (
        <CanvasCreateMenu
          point={createMenu.screen}
          anchor={surface}
          canDocument={
            interactionEnabled &&
            !creating &&
            documentCount < documentLimits.maxCount
          }
          canWebPage={
            interactionEnabled &&
            !creating &&
            sourceCount < sourceLimits.maxCount
          }
          hasWebPages={!!workspaceId}
          onClose={() => setCreateMenu(null)}
          onDocument={() => {
            const position = createMenu.position;
            setCreateMenu(null);
            void addDocument(position);
          }}
          onWebPage={() => {
            if (!addingWebPage) setAddingWebPage(createMenu.position);
            setCreateMenu(null);
          }}
        />
      )}
      <ElementHistoryNotice
        history={history}
        connected={connected && pending === 0}
      />
      {openSourceId && workspaceId && (
        <div
          className="canvas-source-panel"
          onKeyDown={(event) => event.stopPropagation()}
        >
          <WebPageCapturePanel
            key={openSourceId}
            id={openSourceId}
            workspaceId={workspaceId}
            included={selected.has(
              openSourceId as string as import("@pluribus/core/canvas/domain").ElementId,
            )}
            onIncludeChange={(value) => includeSource(openSourceId, value)}
            onClose={() => setOpenSourceId(null)}
            disabled={!interactionEnabled}
          />
        </div>
      )}
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
        <ReactFlow<SceneNode>
          {...canvasSelection}
          nodes={sceneNodes}
          onPaneClick={stopEditing}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            openCreateMenu({ x: event.clientX, y: event.clientY });
          }}
          onMoveStart={() => setCreateMenu(null)}
          onNodeClick={onNodeClick}
          onNodeDragStart={stopEditing}
          onSelectionStart={stopEditing}
          onSelectionDragStart={stopEditing}
          onlyRenderVisibleElements={false}
          edges={emptyEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onSceneNodesChange}
          nodeDragThreshold={documentDragThreshold}
          nodeClickDistance={documentDragThreshold}
          nodesDraggable={interactionEnabled}
          nodesConnectable={false}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          deleteKeyCode={null}
          minZoom={0.1}
          maxZoom={3}
          nodeExtent={nodeExtent}
        >
          {mainPaper && (
            <MainPaperViewport request={paperFocus} surface={surface} />
          )}
          <CanvasActivity nodes={nodes} />
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            ariaLabel="Canvas overview"
            position="bottom-right"
            pannable
            zoomable
            style={{ width: 160, height: 104 }}
            bgColor="var(--overlay)"
            nodeColor="var(--muted-fg)"
            maskColor="color-mix(in srgb, var(--canvas-bg) 75%, transparent)"
            maskStrokeColor="var(--ring)"
            maskStrokeWidth={2}
          />
        </ReactFlow>
      </div>
    </main>
  );
});

type CanvasStore = ReturnType<typeof useCanvas>["store"];
function ElementHistoryNotice({
  history,
  connected,
}: {
  history: ReturnType<typeof useCanvas>["history"];
  connected: boolean;
}) {
  const state = useStore(history.store);
  if (!state.error && !state.retry) return null;
  return (
    <div className="canvas-history" aria-label="Element history">
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
  const { workspaceId } = useCanvasScope();
  const presence = usePresence(
    { kind: "canvas", id: workspaceId ?? "shared" },
    true,
  );
  return <CanvasPresence presence={presence} nodes={nodes} />;
});

export default function CanvasPage({
  workspaceId,
  onSelectionChange,
  mainPaper,
  paperFocus,
}: {
  workspaceId?: Id<"workspaces">;
  onSelectionChange?: (ids: string[]) => void;
  mainPaper?: ReactNode;
  paperFocus?: number;
} = {}) {
  return (
    <CanvasScope.Provider
      value={{ workspaceId, onSelectionChange, mainPaper, paperFocus }}
    >
      <ReactFlowProvider key={workspaceId ?? "shared"}>
        <Canvas />
      </ReactFlowProvider>
    </CanvasScope.Provider>
  );
}
