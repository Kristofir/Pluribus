import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
export type PassageReference = { documentId: string; paragraphId: string };
export type AgentContext = {
  elementIds: readonly string[];
  passages: readonly PassageReference[];
};
export function AgentContextPanel({
  context,
  labels,
  onRemoveElement,
  onRemovePassage,
  onPrepare,
  unavailableReason,
  connectionDetails,
}: {
  context: AgentContext;
  labels: Readonly<Record<string, string>>;
  onRemoveElement: (id: string) => void;
  onRemovePassage: (reference: PassageReference) => void;
  onPrepare: (context: AgentContext) => Promise<void>;
  unavailableReason?: string;
  connectionDetails?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const count = context.elementIds.length + context.passages.length;
  return (
    <section
      aria-label="External agent context"
      className="p-5 rounded-xl border border-border bg-overlay text-fg space-y-4"
    >
      <header className="flex justify-between gap-3">
        <h2 className="font-semibold">Selected context</h2>
        <Badge intent="secondary">{count} selected</Badge>
      </header>
      <p className="text-sm text-muted-fg">
        Choose the material your external agent should work with.
      </p>
      {!count && (
        <p className="text-sm">
          Select cards or document paragraphs to include them.
        </p>
      )}
      <ul className="space-y-2">
        {context.elementIds.map((id) => (
          <li
            key={id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="break-all">{labels[id] ?? id}</span>
            <Button
              intent="plain"
              size="sm"
              onPress={() => onRemoveElement(id)}
              aria-label={`Remove ${labels[id] ?? id} from context`}
            >
              Remove
            </Button>
          </li>
        ))}
        {context.passages.map((ref) => (
          <li
            key={`${ref.documentId}:${ref.paragraphId}`}
            className="flex justify-between gap-3 text-sm"
          >
            <span className="break-all">
              {labels[`${ref.documentId}:${ref.paragraphId}`] ??
                `Paragraph ${ref.paragraphId}`}
            </span>
            <Button
              intent="plain"
              size="sm"
              onPress={() => onRemovePassage(ref)}
              aria-label={`Remove paragraph ${ref.paragraphId} from context`}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {unavailableReason && (
        <p role="status" className="text-sm">
          {unavailableReason}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      <Button
        intent="outline"
        isDisabled={!count || pending || !!unavailableReason}
        onPress={async () => {
          setPending(true);
          setError(undefined);
          try {
            await onPrepare({
              elementIds: [...context.elementIds],
              passages: context.passages.map((ref) => ({ ...ref })),
            });
          } catch {
            setError(
              "Could not prepare agent context. Your selection is retained.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Preparing…" : "Prepare for external agent"}
      </Button>
      {connectionDetails && (
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-fg mb-2">
            External agent connection
          </p>
          <pre className="text-xs whitespace-pre-wrap break-all">
            {connectionDetails}
          </pre>
        </div>
      )}
    </section>
  );
}
