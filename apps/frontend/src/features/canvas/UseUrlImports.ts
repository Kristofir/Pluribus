import { useAction, useMutation } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { useCallback, useEffect, useRef, useState } from "react";
import { waitForMinimumImageLoading } from "./ImageLoadingDelay";
import {
  defaultImageCardSize,
  imageCardSizeFromUrl,
  type ImageCardSize,
} from "./ImageCardSize";

export type UrlDraft = {
  id: string;
  url: string;
  position: { x: number; y: number };
  phase: "checking" | "creating" | "failed" | "waiting";
  error?: string;
  uploadId?: Id<"imageUploadIntents">;
  sourceId?: string;
  imageId?: string;
  kind?: "image" | "webPage";
};

export function useUrlImports({
  workspaceId,
  enabled,
  addImage,
  addWebPage,
  imageIds,
  sourceIds,
}: {
  workspaceId?: Id<"workspaces">;
  enabled: boolean;
  addImage: (
    uploadId: Id<"imageUploadIntents">,
    position: { x: number; y: number },
    size: ImageCardSize,
  ) => Promise<string | undefined>;
  addWebPage: (
    input: { url: string },
    position: { x: number; y: number },
  ) => Promise<string | undefined>;
  imageIds: Set<string>;
  sourceIds: Set<string>;
}) {
  const [drafts, setDrafts] = useState<UrlDraft[]>([]);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const alive = useRef(true);
  const queue = useRef(Promise.resolve());
  const classify = useAction(api.CanvasUrlImport.importUrl);
  const discard = useMutation(api.Canvas.discardImageUpload);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const change = useCallback((id: string, patch: Partial<UrlDraft>) => {
    if (alive.current)
      setDrafts((current) =>
        current.map((draft) =>
          draft.id === id ? { ...draft, ...patch } : draft,
        ),
      );
  }, []);
  const remove = useCallback(
    (id: string) => {
      const draft = draftsRef.current.find((item) => item.id === id);
      if (draft?.uploadId && !draft.imageId)
        void discard({ uploadId: draft.uploadId }).catch(() => {});
      draftsRef.current = draftsRef.current.filter((item) => item.id !== id);
      setDrafts((current) => current.filter((item) => item.id !== id));
    },
    [discard],
  );
  useEffect(() => {
    for (const draft of drafts) {
      if (
        (draft.uploadId && imageIds.has(draft.uploadId)) ||
        (draft.sourceId && sourceIds.has(draft.sourceId))
      )
        remove(draft.id);
    }
  }, [drafts, imageIds, sourceIds, remove]);
  const start = useCallback(
    async (draft: UrlDraft) => {
      if (!workspaceId || !enabled)
        return change(draft.id, {
          phase: "failed",
          error: "Canvas is unavailable. Try again when connected.",
        });
      try {
        const startedAt = performance.now();
        change(draft.id, {
          phase: draft.kind ? "creating" : "checking",
          error: undefined,
        });
        const resolved = draft.kind
          ? draft.kind === "image"
            ? { kind: "image" as const, uploadId: draft.uploadId! }
            : { kind: "webPage" as const, url: draft.url }
          : await classify({ workspaceId, url: draft.url });
        if (
          !alive.current ||
          !draftsRef.current.some((item) => item.id === draft.id)
        ) {
          if (resolved.kind === "image")
            void discard({ uploadId: resolved.uploadId }).catch(() => {});
          return;
        }
        change(draft.id, {
          phase: "creating",
          kind: resolved.kind,
          ...(resolved.kind === "image" ? { uploadId: resolved.uploadId } : {}),
        });
        let size = defaultImageCardSize;
        if (resolved.kind === "image") {
          [, size] = await Promise.all([
            waitForMinimumImageLoading(startedAt),
            imageCardSizeFromUrl(draft.url).catch(() => defaultImageCardSize),
          ]);
          if (
            !alive.current ||
            !draftsRef.current.some((item) => item.id === draft.id)
          ) {
            void discard({ uploadId: resolved.uploadId }).catch(() => {});
            return;
          }
        }
        const operation = queue.current.then(() =>
          resolved.kind === "image"
            ? addImage(resolved.uploadId, draft.position, size)
            : addWebPage({ url: resolved.url }, draft.position),
        );
        queue.current = operation.then(
          () => {},
          () => {},
        );
        const id = await operation;
        if (!id) throw new Error("Card creation was not confirmed. Try again.");
        change(
          draft.id,
          resolved.kind === "image"
            ? { imageId: id, phase: "waiting" }
            : { sourceId: id, phase: "waiting" },
        );
      } catch (error) {
        change(draft.id, {
          phase: "failed",
          error:
            error instanceof Error
              ? error.message
              : "Could not import this URL.",
        });
      }
    },
    [workspaceId, enabled, classify, discard, change, addImage, addWebPage],
  );
  const add = useCallback(
    (url: string, position: { x: number; y: number }) => {
      const draft: UrlDraft = {
        id: crypto.randomUUID(),
        url,
        position,
        phase: "checking",
      };
      setDrafts((current) => [...current, draft]);
      // State must contain the draft before the async action finishes.
      draftsRef.current = [...draftsRef.current, draft];
      void start(draft);
    },
    [start],
  );
  const retry = useCallback(
    (id: string) => {
      const draft = draftsRef.current.find((item) => item.id === id);
      if (draft) void start(draft);
    },
    [start],
  );
  return { drafts, add, retry, remove };
}
