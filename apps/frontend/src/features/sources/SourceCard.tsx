import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TextField } from "@/components/ui/TextField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "react-aria-components/Label";
export type SourceView = {
  id: string;
  canvasId: string;
  url: string;
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
  onFetch: (input: { url: string; prompt?: string }) => Promise<void>;
}) {
  const [url, setUrl] = useState(source?.url ?? "");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const busy = submitting || source?.status === "fetching";
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
        <Badge intent="secondary">
          {busy ? "Fetching" : (source?.status ?? "Not fetched")}
        </Badge>
      </header>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || unavailableReason) return;
          setError(undefined);
          try {
            const parsed = new URL(url);
            if (!["https:", "http:"].includes(parsed.protocol)) throw Error();
          } catch {
            setError("Enter a complete http or https URL.");
            return;
          }
          setSubmitting(true);
          try {
            await onFetch({
              url: url.trim(),
              ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
            });
          } catch {
            setError(
              "The request could not be completed. Check its status before trying again.",
            );
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <TextField
          value={url}
          onChange={setUrl}
          type="url"
          isRequired
          isDisabled={busy}
        >
          <Label>Page URL</Label>
          <Input placeholder="https://example.com/article" />
        </TextField>
        <TextField value={prompt} onChange={setPrompt} isDisabled={busy}>
          <Label>
            What would you like to extract?{" "}
            <span className="text-muted-fg">Optional</span>
          </Label>
          <Textarea placeholder="Leave blank to retrieve the main page content." />
        </TextField>
        {unavailableReason && (
          <p role="status" className="text-sm text-muted-fg">
            {unavailableReason}
          </p>
        )}
        <Button type="submit" isDisabled={busy || !!unavailableReason}>
          {busy ? "Fetching source…" : "Fetch page"}
        </Button>
      </form>
      {(error || source?.error) && (
        <p role="alert" className="text-sm">
          {error ?? source?.error}
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
