import { Button } from "@/components/ui/Button";
/** The editor adapter resolves stable paragraph identity; never fall back to a different paragraph. */
export function DocumentParagraphLink({
  reference,
  label,
  unavailableReason,
  onOpen,
}: {
  reference: { documentId: string; paragraphId: string };
  label: string;
  unavailableReason?: string;
  onOpen: (reference: { documentId: string; paragraphId: string }) => void;
}) {
  return (
    <div className="text-sm">
      <Button
        intent="plain"
        size="sm"
        isDisabled={!!unavailableReason}
        onPress={() => onOpen(reference)}
      >
        {label} ↗
      </Button>
      {unavailableReason && (
        <p className="text-xs text-muted-fg">{unavailableReason}</p>
      )}
    </div>
  );
}
