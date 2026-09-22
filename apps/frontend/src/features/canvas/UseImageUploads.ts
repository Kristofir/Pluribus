import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { imageLimits, imageTypes } from "@pluribus/core/canvas/domain";
import { waitForMinimumImageLoading } from "./ImageLoadingDelay";
import { imageCardSizeFromUrl, type ImageCardSize } from "./ImageCardSize";

export type ImageDraft = {
  id: string;
  file: File;
  preview: string;
  position: { x: number; y: number };
  phase: "uploading" | "saving" | "failed" | "complete";
  progress: number;
  error?: string;
  uploadId?: Id<"imageUploadIntents">;
  imageId?: string;
  retryCreate?: boolean;
};

function uploadFile(
  url: string,
  file: File,
  progress: (value: number) => void,
  requests: Set<XMLHttpRequest>,
) {
  return new Promise<Id<"_storage">>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    requests.add(xhr);
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        progress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Network interrupted during upload."));
    xhr.onabort = () => reject(new Error("Upload canceled."));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300)
        return reject(new Error("Upload failed. Try again."));
      try {
        const result: unknown = JSON.parse(xhr.responseText);
        if (
          !result ||
          typeof result !== "object" ||
          !("storageId" in result) ||
          typeof result.storageId !== "string"
        )
          throw new Error("Upload response was incomplete.");
        resolve(result.storageId as Id<"_storage">);
      } catch {
        reject(new Error("Upload response was incomplete."));
      }
    };
    xhr.onloadend = () => requests.delete(xhr);
    xhr.send(file);
  });
}

/** Drafts are local until a validated file is claimed by a durable History creation. */
export function useImageUploads({
  workspaceId,
  enabled,
  addImage,
  imageIds,
}: {
  workspaceId?: Id<"workspaces">;
  enabled: boolean;
  addImage: (
    uploadId: Id<"imageUploadIntents">,
    position: { x: number; y: number },
    size: ImageCardSize,
  ) => Promise<string | undefined>;
  imageIds: Set<string>;
}) {
  const [drafts, setDrafts] = useState<ImageDraft[]>([]);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const requests = useRef(new Set<XMLHttpRequest>());
  const queue = useRef(Promise.resolve());
  const alive = useRef(true);
  const prepare = useMutation(api.Canvas.prepareImageUpload);
  const register = useMutation(api.Canvas.registerImageUpload);
  const discard = useMutation(api.Canvas.discardImageUpload);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      for (const xhr of requests.current) xhr.abort();
      for (const draft of draftsRef.current) URL.revokeObjectURL(draft.preview);
    };
  }, []);
  const change = useCallback((id: string, patch: Partial<ImageDraft>) => {
    if (alive.current)
      setDrafts((current) =>
        current.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      );
  }, []);
  const remove = useCallback(
    (id: string) => {
      const draft = draftsRef.current.find((d) => d.id === id);
      if (draft) {
        URL.revokeObjectURL(draft.preview);
        if (draft.uploadId && !draft.imageId)
          void discard({ uploadId: draft.uploadId }).catch(() => {});
      }
      draftsRef.current = draftsRef.current.filter((d) => d.id !== id);
      setDrafts((current) => current.filter((d) => d.id !== id));
    },
    [discard],
  );
  useEffect(() => {
    for (const draft of drafts)
      if (draft.uploadId && imageIds.has(draft.uploadId)) remove(draft.id);
  }, [drafts, imageIds, remove]);
  const save = useCallback(
    async (
      draft: ImageDraft,
      uploadId: Id<"imageUploadIntents">,
      startedAt = performance.now(),
    ) => {
      change(draft.id, {
        phase: "saving",
        progress: 100,
        uploadId,
        retryCreate: true,
      });
      const [, size] = await Promise.all([
        waitForMinimumImageLoading(startedAt),
        imageCardSizeFromUrl(draft.preview),
      ]);
      if (
        !alive.current ||
        !draftsRef.current.some((item) => item.id === draft.id)
      ) {
        void discard({ uploadId }).catch(() => {});
        return;
      }
      // History owns a single write at a time; simultaneous file drops retain their own drafts.
      const operation = queue.current.then(() =>
        addImage(uploadId, draft.position, size),
      );
      queue.current = operation.then(
        () => {},
        () => {},
      );
      const imageId = await operation;
      if (!imageId)
        throw new Error(
          "Image creation was not confirmed. Retry when the canvas is ready.",
        );
      change(draft.id, { imageId, phase: "complete" });
    },
    [addImage, change, discard],
  );
  const start = useCallback(
    async (draft: ImageDraft) => {
      if (!workspaceId || !enabled)
        return change(draft.id, {
          phase: "failed",
          error: "Canvas is unavailable. Try again when connected.",
        });
      if (
        !imageTypes.includes(draft.file.type as (typeof imageTypes)[number]) ||
        !draft.file.size ||
        draft.file.size > imageLimits.maxBytes
      )
        return change(draft.id, {
          phase: "failed",
          error: "Use PNG, JPEG, GIF or WebP under 10 MB.",
        });
      let uploadId: Id<"imageUploadIntents"> | undefined;
      let registered = false;
      const startedAt = performance.now();
      try {
        change(draft.id, {
          phase: "uploading",
          progress: 0,
          error: undefined,
          retryCreate: false,
          uploadId: undefined,
        });
        const prepared = await prepare({ workspaceId });
        uploadId = prepared.uploadId;
        if (!alive.current) {
          void discard({ uploadId }).catch(() => {});
          return;
        }
        change(draft.id, { uploadId });
        const storageId = await uploadFile(
          prepared.url,
          draft.file,
          (progress) => change(draft.id, { progress }),
          requests.current,
        );
        if (!alive.current) {
          void discard({ uploadId }).catch(() => {});
          return;
        }
        const accepted = await register({
          uploadId,
          storageId,
          name: draft.file.name,
        });
        if (!accepted)
          throw new Error("Use PNG, JPEG, GIF or WebP under 10 MB.");
        registered = true;
        if (!alive.current) {
          void discard({ uploadId }).catch(() => {});
          return;
        }
        await save(draft, uploadId, startedAt);
      } catch (error) {
        if (!registered && uploadId) void discard({ uploadId }).catch(() => {});
        change(draft.id, {
          phase: "failed",
          error:
            error instanceof Error
              ? error.message
              : "Upload failed. Try again.",
        });
      }
    },
    [workspaceId, enabled, prepare, register, discard, save, change],
  );
  const add = useCallback(
    (files: File[], position: { x: number; y: number }) => {
      const created = files.map((file, index): ImageDraft => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        position: { x: position.x + index * 28, y: position.y + index * 28 },
        phase: "uploading",
        progress: 0,
      }));
      setDrafts((current) => [...current, ...created]);
      draftsRef.current = [...draftsRef.current, ...created];
      for (const draft of created) void start(draft);
    },
    [start],
  );
  const retry = useCallback(
    (id: string) => {
      const draft = draftsRef.current.find((d) => d.id === id);
      if (!draft || !enabled) return;
      if (draft.retryCreate && draft.uploadId)
        void save(draft, draft.uploadId).catch((error) =>
          change(id, {
            phase: "failed",
            error:
              error instanceof Error ? error.message : "Could not add image.",
          }),
        );
      else void start(draft);
    },
    [enabled, save, start, change],
  );
  return { drafts, add, retry, remove };
}
