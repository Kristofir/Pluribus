import { useState } from "react";
import { httpUrl } from "./UrlDrops";

export function ImportUrlForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (url: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="canvas-url-form nodrag nopan"
      onSubmit={(event) => {
        event.preventDefault();
        if (!httpUrl(url.trim()))
          return setError("Enter a complete HTTP or HTTPS URL.");
        onSubmit(url.trim());
      }}
    >
      <label htmlFor="canvas-import-url">Import URL</label>
      <input
        id="canvas-import-url"
        type="url"
        autoFocus
        placeholder="https://example.com/page-or-image"
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
          setError("");
        }}
      />
      {error && <span role="alert">{error}</span>}
      <div className="canvas-image-actions">
        <button type="submit">Import</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
