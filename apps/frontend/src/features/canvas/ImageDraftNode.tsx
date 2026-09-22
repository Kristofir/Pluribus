import { useCardEntrance } from "../../hooks/UseCardEntrance";
import type { Node, NodeProps } from "@xyflow/react";
import type { ImageDraft } from "./UseImageUploads";

export type ImageDraftNode = Node<
  {
    draft: ImageDraft;
    retry: () => void;
    remove: () => void;
    canRetry: boolean;
  },
  "imageDraft"
>;

export function ImageDraftCard({ data }: NodeProps<ImageDraftNode>) {
  const entrance = useCardEntrance();
  const { draft } = data;
  return (
    <section
      style={entrance}
      className="canvas-card canvas-image-card canvas-image-draft"
      aria-label={`Uploading image: ${draft.file.name}`}
    >
      <div className="canvas-image-frame">
        <img src={draft.preview} alt="" draggable={false} />
        <div className="canvas-image-status" role="status" aria-live="polite">
          {draft.phase === "failed" ? (
            <>
              <span role="alert">{draft.error}</span>
              <div className="canvas-image-actions nodrag nopan">
                <button
                  type="button"
                  disabled={!data.canRetry}
                  onClick={data.retry}
                >
                  Retry
                </button>
                <button type="button" onClick={data.remove}>
                  Remove
                </button>
              </div>
            </>
          ) : draft.phase === "complete" ? (
            "Adding to canvas…"
          ) : (
            <>
              <span>
                {draft.phase === "saving"
                  ? "Adding to canvas…"
                  : `Uploading ${draft.progress}%`}
              </span>
              {draft.phase === "uploading" && (
                <progress
                  value={draft.progress}
                  max={100}
                  aria-label="Image upload progress"
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
