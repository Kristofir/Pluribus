import type {
  CanvasElement,
  DocumentElement,
  SourceElement,
  ElementId,
} from "@pluribus/core/canvas/domain";
import type { Id } from "@pluribus/backend/dataModel";
import type { CanvasState } from "./CanvasStore";
import type { DocumentNode } from "./DocumentNode";
import type { WebPageNode } from "./WebPageNode";
import type { WebPageView } from "../sources/WebPageView";
export type CanvasNode = DocumentNode | WebPageNode;

/** Derive React Flow nodes without owning a second scene or editor instances. */
export function canvasNodes(
  records: CanvasElement[] | undefined,
  {
    gestures,
    removing,
    selected,
    editing,
    setEditing,
  }: Pick<
    CanvasState<ElementId>,
    "gestures" | "removing" | "selected" | "editing" | "setEditing"
  >,
  {
    interactionEnabled,
    readPaused,
  }: { interactionEnabled: boolean; readPaused: boolean },
  {
    pending,
    contentHeight,
    sources,
  }: {
    pending: (id: ElementId, value: boolean) => void;
    contentHeight: (id: ElementId, generation: number, height: number) => void;
    sources?: {
      workspaceId: Id<"workspaces">;
      views: Map<string, WebPageView>;
      open: (id: Id<"sources">) => void;
      include: (id: string, included: boolean) => void;
    };
  },
): CanvasNode[] {
  return (records ?? [])
    .filter(
      (r): r is DocumentElement | SourceElement =>
        r.kind !== "rectangle" && !r.removed,
    )
    .flatMap((r): CanvasNode[] => {
      const geometry = gestures.get(r.id)?.geometry ?? r.geometry;
      if (r.kind === "source") {
        const source = sources?.views.get(r.id);
        if (!source || !sources) return [];
        return [
          {
            id: r.id,
            type: "source",
            position: { x: geometry.x, y: geometry.y },
            width: geometry.width,
            height: geometry.height,
            measured: { width: geometry.width, height: geometry.height },
            selected: selected.has(r.id),
            draggable: interactionEnabled && !removing.has(r.id),
            data: {
              source,
              contentHeight: (height: number) =>
                contentHeight(r.id, r.generation, height),
              workspaceId: sources.workspaceId,
              editable: interactionEnabled && !removing.has(r.id),
              included: selected.has(r.id),
              include: (value) => sources.include(r.id, value),
              open: () => sources.open(r.id as string as Id<"sources">),
            },
            ariaLabel: "Web page card",
          },
        ];
      }
      return [
        {
          id: r.id,
          type: "document",
          position: { x: geometry.x, y: geometry.y },
          width: geometry.width,
          height: geometry.height,
          measured: { width: geometry.width, height: geometry.height },
          selected: selected.has(r.id),
          dragHandle: ".document-drag-handle",
          draggable: interactionEnabled && !r.removed && !removing.has(r.id),
          data: {
            documentId: r.documentId as string as Id<"documents">,
            generation: r.generation,
            removed: r.removed,
            editable: interactionEnabled && !removing.has(r.id),
            readPaused,
            editing: editing === r.id,
            activate: (active: boolean) => setEditing(active ? r.id : null),
            contentHeight: (height: number) =>
              contentHeight(r.id, r.generation, height),
            pending: (value: boolean) => {
              pending(r.id, value);
            },
          },
          ariaLabel: "Document card",
        },
      ];
    });
}

/** Per-canvas bounded projection cache; Convex remains the owner of scene data. */
export function createCanvasNodeProjector() {
  let previous: CanvasNode[] = [];
  let previousSetEditing: CanvasState<ElementId>["setEditing"] | undefined;
  let previousActions: Parameters<typeof canvasNodes>[3] | undefined;
  return (...args: Parameters<typeof canvasNodes>): CanvasNode[] => {
    const actions = args[3];
    const stableActions =
      previousSetEditing === args[1].setEditing &&
      previousActions?.pending === actions.pending &&
      previousActions?.contentHeight === actions.contentHeight;
    const byId = new Map(previous.map((node) => [node.id, node]));
    const next = canvasNodes(...args).map((node) => {
      const old = byId.get(node.id);
      if (!old || old.type !== node.type) return node;
      if (
        node.type === "document" &&
        old.type === "document" &&
        stableActions
      ) {
        node.data.pending = old.data.pending;
        if (
          node.data.documentId === old.data.documentId &&
          node.data.generation === old.data.generation &&
          node.data.removed === old.data.removed &&
          node.data.editable === old.data.editable &&
          node.data.readPaused === old.data.readPaused &&
          node.data.editing === old.data.editing
        )
          node.data = old.data;
      }
      if (
        node.type === "source" &&
        old.type === "source" &&
        previousActions?.sources?.open === actions.sources?.open &&
        previousActions?.sources?.include === actions.sources?.include &&
        node.data.editable === old.data.editable &&
        node.data.included === old.data.included &&
        JSON.stringify(node.data.source) === JSON.stringify(old.data.source)
      )
        node.data = old.data;
      if (
        node.data === old.data &&
        node.selected === old.selected &&
        node.draggable === old.draggable &&
        node.position.x === old.position.x &&
        node.position.y === old.position.y &&
        node.width === old.width &&
        node.height === old.height
      )
        return old;
      return node;
    });
    previousSetEditing = args[1].setEditing;
    previousActions = actions;
    if (
      next.length === previous.length &&
      next.every((node, i) => node === previous[i])
    )
      return previous;
    previous = next;
    return next;
  };
}
