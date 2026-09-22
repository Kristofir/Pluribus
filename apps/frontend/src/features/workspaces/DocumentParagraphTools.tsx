import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { Button } from "@/components/ui/Button";
export function DocumentParagraphTools({
  workspaceId,
  documentId,
  selected,
  pending,
  paused,
}: {
  workspaceId: Id<"workspaces">;
  documentId: Id<"documents">;
  selected: string[];
  pending: boolean;
  paused: boolean;
}) {
  const rows = useRetainedQuery(api.Documents.paragraphs, { documentId }),
    link = useMutation(api.Documents.linkParagraph);
  const [error, setError] = useState<string>(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string>();
  return (
    <details className="mt-6 border-t border-border pt-4">
      <summary className="cursor-pointer font-medium text-sm">
        Paragraph links
      </summary>
      <p className="text-xs text-muted-fg my-3">
        To link a card, select exactly one canvas element, then choose its
        paragraph.
      </p>
      {pending && (
        <p role="status" className="text-sm">
          Save local edits before selecting a paragraph.
        </p>
      )}
      {rows.failed && <p role="alert">Paragraphs unavailable.</p>}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <ul className="space-y-3">
        {rows.data?.paragraphs
          .filter((p) => p.paragraphId)
          .map((paragraph) => (
            <li
              key={paragraph.paragraphId}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <p className="whitespace-pre-wrap break-words">
                {paragraph.text || "Empty paragraph"}
              </p>
              <Button
                intent="plain"
                size="sm"
                isDisabled={
                  paused ||
                  pending ||
                  busy ||
                  rows.failed ||
                  selected.length !== 1
                }
                onPress={async () => {
                  setBusy(true);
                  setError(undefined);
                  setNotice(undefined);
                  try {
                    await link({
                      workspaceId,
                      elementId: selected[0] as
                        Id<"canvasDocuments"> | Id<"sources">,
                      documentId,
                      paragraphId: paragraph.paragraphId,
                      version: rows.data!.version,
                    });
                    setNotice("Selected element linked to this paragraph.");
                  } catch {
                    setError(
                      "The element or paragraph changed. Check your selection and try again.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Link selected element here
              </Button>
            </li>
          ))}
      </ul>
    </details>
  );
}
