import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "react-aria-components/Label";
import { webPageRequestError, webPageUrl } from "./WebPageView";
import "./WebPages.css";
export type WebPageInput = {
  url: string;
  prompt?: string;
};
export function WebPageForm({
  onSubmit,
  onCancel,
  disabled = false,
  compact = false,
  initial,
  submitLabel,
}: {
  onSubmit: (input: WebPageInput) => Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
  compact?: boolean;
  initial?: WebPageInput;
  submitLabel?: string;
}) {
  const [url, setUrl] = useState(initial?.url ?? ""),
    [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  return (
    <form
      className={`web-page-form nodrag nopan${compact ? " web-page-form-compact" : ""}`}
      aria-label={initial ? "Edit web page extraction" : "Add web page"}
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled || busy) return;
        if (!webPageUrl(url.trim())) {
          setError("Enter a complete http or https URL.");
          return;
        }
        setError(undefined);
        setBusy(true);
        try {
          await onSubmit({
            url: url.trim(),
            ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
          });
        } catch (error) {
          setError(webPageRequestError(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField
        value={url}
        onChange={setUrl}
        type="url"
        isRequired
        isDisabled={disabled || busy}
      >
        <Label className={compact ? "sr-only" : undefined}>Page URL</Label>
        <Input
          autoFocus={compact}
          placeholder={
            compact ? "Page URL to fetch" : "https://example.com/article"
          }
        />
      </TextField>
      <TextField
        value={prompt}
        onChange={setPrompt}
        isDisabled={disabled || busy}
      >
        <Label className={compact ? "sr-only" : undefined}>
          What to extract <span className="web-page-optional">(optional)</span>
        </Label>
        <Textarea
          placeholder={
            compact
              ? "What content should be extracted?"
              : "Leave blank to capture the main page content."
          }
        />
      </TextField>
      {!compact && (
        <p className="web-page-form-hint">
          Captures are read-only. Use a Document Card to write your own notes.
        </p>
      )}
      {error && (
        <p role="alert" className="web-page-error">
          {error}
        </p>
      )}
      <div className="web-page-form-buttons">
        <Button type="submit" isDisabled={disabled || busy}>
          {busy
            ? "Fetching…"
            : (submitLabel ?? (compact ? "Fetch" : "Add web page"))}
        </Button>
        {onCancel && !compact && (
          <Button intent="plain" isDisabled={busy} onPress={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
