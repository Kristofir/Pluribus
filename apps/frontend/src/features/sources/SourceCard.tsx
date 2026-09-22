import { WebPageForm, type WebPageInput } from "./WebPageForm";
export type SourceView = {
  id: string;
  canvasId: string;
  url: string;
  prompt?: string;
  table?: { columns: string[] };
  status: "idle" | "fetching" | "ready" | "failed" | "unavailable";
  result?: string;
  error?: string;
};
export function SourceCard({
  source,
  unavailableReason,
  onFetch,
}: {
  source?: SourceView;
  unavailableReason?: string;
  onFetch: (input: WebPageInput) => Promise<void>;
}) {
  const busy = source?.status === "fetching";
  let safeUrl: string | undefined;
  try {
    const parsed = new URL(source?.url ?? "");
    if (["https:", "http:"].includes(parsed.protocol)) safeUrl = parsed.href;
  } catch {
    /* Display invalid source URLs as text, never executable links. */
  }
  return (
    <section
      aria-label="External source"
      className="rounded-xl border border-border bg-overlay p-5 text-fg space-y-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-fg mb-2">
            Source material
          </p>
          <h2 className="text-lg font-semibold">Bring in a web page</h2>
        </div>
      </header>
      <WebPageForm
        initial={source}
        disabled={busy || !!unavailableReason}
        submitLabel="Fetch page"
        onSubmit={onFetch}
      />
      {(unavailableReason || source?.error) && (
        <p role="status" className="text-sm">
          {unavailableReason ?? source?.error}
        </p>
      )}
      {source && (
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-xs text-muted-fg">Source</p>
          {safeUrl ? (
            <a
              href={safeUrl}
              target="_blank"
              rel="noreferrer"
              className="underline break-all text-sm"
            >
              {source.url}
            </a>
          ) : (
            <p className="break-all text-sm">{source.url}</p>
          )}
          {source.result !== undefined && (
            <div className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm leading-6">
              {source.result}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
