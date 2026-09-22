import { useState } from "react";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { webPageUrl } from "./WebPageView";
/** Receives only a capture-owned image URL, never the page URL itself. */
export function CaptureScreenshot({
  url,
  title,
  onOpen,
}: {
  url: string;
  title: string;
  onOpen?: () => void;
}) {
  return <ScreenshotImage key={url} url={url} title={title} onOpen={onOpen} />;
}
function ScreenshotImage({
  url,
  title,
  onOpen,
}: {
  url: string;
  title: string;
  onOpen?: () => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const safe = webPageUrl(url)?.href;
  const failed = !safe || state === "failed";
  const image = (
    <div
      className="capture-screenshot-image"
      aria-busy={!failed && state === "loading"}
    >
      {failed ? (
        <span className="capture-screenshot-unavailable">
          <PhotoIcon aria-hidden="true" />
          <span>Preview unavailable</span>
        </span>
      ) : (
        <img
          src={safe}
          alt={`Above-the-fold capture of ${title}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
          style={{ opacity: state === "ready" ? 1 : 0 }}
        />
      )}
      {!failed && state === "loading" && (
        <span className="sr-only">Loading captured screenshot</span>
      )}
    </div>
  );
  return onOpen ? (
    <button
      type="button"
      className="capture-screenshot nodrag nopan"
      onClick={onOpen}
      aria-label={`Open captured screenshot and content: ${title}`}
    >
      {image}
    </button>
  ) : (
    <figure className="capture-screenshot">{image}</figure>
  );
}
