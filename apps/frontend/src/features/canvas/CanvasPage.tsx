import { useCardEntrance } from "../../hooks/UseCardEntrance";
import { CanvasElementMenu } from "./CanvasElementMenu";
import { SnapPreview } from "./SnapPreview";
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
import { ImageCard } from "./ImageNode";
import { ImageDraftCard, type ImageDraftNode } from "./ImageDraftNode";
import { useImageUploads } from "./UseImageUploads";
import { useUrlImports } from "./UseUrlImports";
import { droppedUrl } from "./UrlDrops";
import { ImportUrlForm } from "./ImportUrlForm";
import {
  UrlImportDraftCard,
  type UrlImportDraftNode,
} from "./UrlImportDraftNode";
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
  useRef,
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
const urlFormId = "local-url-form";
function WebPageDraft({ data }: NodeProps<WebPageDraftNode>) {
  const entrance = useCardEntrance();
  return (
    <section
      style={entrance}
      className="canvas-card web-page-card"
      aria-label="New web page card"
    >
      {data.content}
    </section>
  );
}
type SceneNode =
  | CanvasNode
  | MainPaperNode
  | WebPageDraftNode
  | ImageDraftNode
  | UrlImportDraftNode;
const nodeTypes = {
  document: DocumentCard,
  source: WebPageNodeCard,
  image: ImageCard,
  imageDraft: ImageDraftCard,
  urlImportDraft: UrlImportDraftCard,
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
      presence.agents,
      presence.identity,
      presence.show,
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
  const viewportKey = `pluribus:viewport:${workspaceId ?? "shared"}`;
  const [addingWebPage, setAddingWebPage] = useState<{
    x: number;
    y: number;
    sourceId?: string;
  } | null>(null);
  const [addingUrl, setAddingUrl] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [createMenu, setCreateMenu] = useState<{
    screen: { x: number; y: number };
    position: { x: number; y: number };
  } | null>(null);
  const {
    nodes,
    snapPreviews,
    arrangeSelection,
    onNodesChange,
    addDocument,
    addWebPage,
    addImage,
    sourceCount,
    imageCount,
    imageUploadIds,
    openSourceId,
    setOpenSourceId,
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
  const imagePicker = useRef<HTMLInputElement>(null);
  const imagePickerPosition = useRef({ x: 0, y: 0 });
  const uploads = useImageUploads({
    workspaceId,
    enabled: interactionEnabled && imageCount < 100,
    addImage,
    imageIds: imageUploadIds,
  });
  const urlImports = useUrlImports({
    workspaceId,
    enabled: interactionEnabled,
    addImage,
    addWebPage,
    imageIds: imageUploadIds,
    sourceIds: new Set(
      nodes.filter((node) => node.type === "source").map((node) => node.id),
    ),
  });
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
  const [elementMenu, setElementMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const openElementMenu = (point: { x: number; y: number }, id?: string) => {
    const current = store.getState();
    if (
      id &&
      !current.selected.has(
        id as import("@pluribus/core/canvas/domain").ElementId,
      )
    ) {
      current.select(
        [...current.selected]
          .map((id) => ({ id, selected: false }))
          .concat([
            {
              id: id as import("@pluribus/core/canvas/domain").ElementId,
              selected: true,
            },
          ]),
      );
    }
    stopEditing();
    setCreateMenu(null);
    setElementMenu(point);
  };
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
    for (const draft of uploads.drafts) {
      if (draft.uploadId && imageUploadIds.has(draft.uploadId)) continue;
      sceneNodes.push({
        id: draft.id,
        type: "imageDraft",
        position: draft.position,
        width: 360,
        height: 276,
        draggable: false,
        selectable: false,
        deletable: false,
        connectable: false,
        zIndex: 1001,
        data: {
          draft,
          canRetry: interactionEnabled,
          retry: () => uploads.retry(draft.id),
          remove: () => uploads.remove(draft.id),
        },
      });
    }
    if (addingUrl)
      sceneNodes.push({
        id: urlFormId,
        type: "webPageDraft",
        position: addingUrl,
        width: 320,
        draggable: false,
        selectable: false,
        deletable: false,
        connectable: false,
        zIndex: 1001,
        data: {
          content: (
            <ImportUrlForm
              onCancel={() => setAddingUrl(null)}
              onSubmit={(url) => {
                urlImports.add(url, addingUrl);
                setAddingUrl(null);
              }}
            />
          ),
        },
      });
    for (const draft of urlImports.drafts) {
      if (
        (draft.uploadId && imageUploadIds.has(draft.uploadId)) ||
        (draft.sourceId && nodes.some((node) => node.id === draft.sourceId))
      )
        continue;
      sceneNodes.push({
        id: draft.id,
        type: "urlImportDraft",
        position: draft.position,
        width: 320,
        draggable: false,
        selectable: false,
        deletable: false,
        connectable: false,
        zIndex: 1001,
        data: {
          draft,
          canRetry: interactionEnabled,
          retry: () => urlImports.retry(draft.id),
          remove: () => urlImports.remove(draft.id),
        },
      });
    }
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
    uploads.drafts,
    uploads.retry,
    uploads.remove,
    imageUploadIds,
    addingUrl,
    urlImports.drafts,
    urlImports.add,
    urlImports.retry,
    urlImports.remove,
  ]);
  const onSceneNodesChange = useCallback(
    (changes: NodeChange<SceneNode>[]) => {
      // Paper measurement/selection is local to React Flow and cannot become an element operation.
      onNodesChange(
        changes.filter((change) =>
          "id" in change
            ? change.id !== mainPaperId &&
              change.id !== webPageDraftId &&
              change.id !== urlFormId &&
              !urlImports.drafts.some((d) => d.id === change.id) &&
              !uploads.drafts.some((d) => d.id === change.id)
            : change.item.id !== mainPaperId &&
              change.item.id !== webPageDraftId &&
              change.item.id !== urlFormId &&
              !urlImports.drafts.some((d) => d.id === change.item.id) &&
              !uploads.drafts.some((d) => d.id === change.item.id),
        ) as NodeChange<CanvasNode>[],
      );
    },
    [onNodesChange, uploads.drafts, urlImports.drafts],
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
          event.key === "ContextMenu" ||
          (event.shiftKey && event.key === "F10")
        ) {
          event.preventDefault();
          const bounds = surface.current?.getBoundingClientRect();
          if (bounds) {
            const point = {
              x: bounds.left + bounds.width / 2,
              y: bounds.top + bounds.height / 2,
            };
            if (selected.size) openElementMenu(point);
            else openCreateMenu(point);
          }
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
      {elementMenu && selected.size > 0 && (
        <CanvasElementMenu
          point={elementMenu}
          anchor={surface}
          count={selected.size}
          disabled={!interactionEnabled || pending > 0}
          onClose={() => setElementMenu(null)}
          onDelete={() => {
            setElementMenu(null);
            void deleteSelection();
          }}
          onArrange={(mode) => {
            setElementMenu(null);
            arrangeSelection(mode);
          }}
        />
      )}
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
          canImage={interactionEnabled && !creating && imageCount < 100}
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
          onImage={() => {
            imagePickerPosition.current = createMenu.position;
            setCreateMenu(null);
            imagePicker.current?.click();
          }}
          onImportUrl={() => {
            setAddingUrl(createMenu.position);
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
            onClose={() => setOpenSourceId(null)}
            disabled={!interactionEnabled}
          />
        </div>
      )}
      <CanvasError store={store} queryFailed={queryFailed} />
      <input
        ref={imagePicker}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        tabIndex={-1}
        className="canvas-image-file-input"
        aria-label="Choose images for canvas"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length) uploads.add(files, imagePickerPosition.current);
        }}
      />
      <div
        ref={surface}
        className="canvas-surface"
        onDragOverCapture={(event) => {
          if (
            ["Files", "text/uri-list", "text/html", "text/plain"].some((type) =>
              event.dataTransfer.types.includes(type),
            )
          ) {
            event.preventDefault();
            event.dataTransfer.dropEffect =
              workspaceId && interactionEnabled ? "copy" : "none";
          }
        }}
        onDropCapture={(event) => {
          const url = droppedUrl(event.dataTransfer);
          if (!url && !event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          event.stopPropagation();
          if (!workspaceId || !interactionEnabled) return;
          const files = Array.from(event.dataTransfer.files);
          if (!files.length && !url) return;
          const position = flow.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          const cardPosition = {
            x: Math.max(
              -geometryLimits.maxCoordinate,
              Math.min(geometryLimits.maxCoordinate - 360, position.x - 180),
            ),
            y: Math.max(
              -geometryLimits.maxCoordinate,
              Math.min(geometryLimits.maxCoordinate - 276, position.y - 50),
            ),
          };
          if (url) urlImports.add(url, cardPosition);
          else uploads.add(files, cardPosition);
        }}
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
        <div className="canvas-presence-overlay">{roster}</div>
        <ReactFlow<SceneNode>
          {...canvasSelection}
          nodes={sceneNodes}
          onPaneClick={stopEditing}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            setElementMenu(null);
            openCreateMenu({ x: event.clientX, y: event.clientY });
          }}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            if (
              node.type === "document" ||
              node.type === "source" ||
              node.type === "image"
            )
              openElementMenu({ x: event.clientX, y: event.clientY }, node.id);
          }}
          onSelectionContextMenu={(event) => {
            event.preventDefault();
            openElementMenu({ x: event.clientX, y: event.clientY });
          }}
          onMoveStart={() => {
            setCreateMenu(null);
            setElementMenu(null);
          }}
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
          <MainPaperViewport
            request={paperFocus}
            surface={surface}
            storageKey={viewportKey}
            framePaper={!!mainPaper}
          />
          <CanvasActivity nodes={nodes} />
          <SnapPreview previews={snapPreviews} />
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
