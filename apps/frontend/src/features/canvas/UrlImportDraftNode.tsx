import type { Node, NodeProps } from "@xyflow/react";
import type { UrlDraft } from "./UseUrlImports";

export type UrlImportDraftNode = Node<
  {
    draft: UrlDraft;
    retry: () => void;
    remove: () => void;
    canRetry: boolean;
  },
  "urlImportDraft"
>;

export function UrlImportDraftCard({ data }: NodeProps<UrlImportDraftNode>) {
  const { draft } = data;
  return (
    <section className="canvas-url-draft nodrag nopan" aria-label="Import URL">
      <strong>
        {draft.kind === "image"
          ? "Image"
          : draft.kind === "webPage"
            ? "Web page"
            : "Importing URL"}
      </strong>
      <span className="canvas-url-draft-address" title={draft.url}>
        {draft.url}
      </span>
      {draft.phase === "failed" ? (
        <>
          <span role="alert">{draft.error}</span>
          <div className="canvas-image-actions">
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
      ) : (
        <span role="status" aria-live="polite">
          {draft.phase === "checking"
            ? "Checking URL…"
            : draft.phase === "creating"
              ? "Adding to canvas…"
              : "Finishing…"}
        </span>
      )}
    </section>
  );
}
