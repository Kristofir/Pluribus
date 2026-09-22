import { CaptureScreenshot } from "./CaptureScreenshot";
import { CaptureContent } from "./CaptureContent";
import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { WebPageActions } from "./WebPageActions";
import {
  captureUrl,
  webPageStatus,
  webPageTitle,
  webPageUrl,
  type WebPageActionsProps,
} from "./WebPageView";
import "./WebPages.css";
export function WebPagePanel({
  onClose,
  ...props
}: WebPageActionsProps & { onClose: () => void }) {
  const heading = useId();
  const { source } = props,
    url = webPageUrl(captureUrl(source));
  return (
    <aside className="web-page-panel" aria-labelledby={heading}>
      <header className="web-page-panel-heading">
        <div>
          <p className="web-page-eyebrow">Web page · read only</p>
          <h2 id={heading} tabIndex={-1}>
            {webPageTitle(source)}
          </h2>
        </div>
        <Button
          intent="plain"
          size="sm"
          aria-label="Close web page panel"
          onPress={onClose}
        >
          Close ×
        </Button>
      </header>
      <div className="web-page-panel-meta">
        {url ? (
          <a
            href={url.href}
            target="_blank"
            rel="noopener noreferrer"
            className="web-page-source-link"
          >
            {captureUrl(source)}
          </a>
        ) : (
          <p className="web-page-source-link">{captureUrl(source)}</p>
        )}
        {source.status !== "ready" && (
          <p className="web-page-status" role="status">
            {webPageStatus(source)}
          </p>
        )}
        {source.capture?.url && source.capture.url !== source.url && (
          <p className="web-page-prompt">Latest requested URL: {source.url}</p>
        )}
        {source.status === "failed" && source.error && (
          <p role="alert" className="web-page-error">
            {source.error}
          </p>
        )}
        <WebPageActions {...props} />
      </div>
      <div
        className="web-page-panel-scroll"
        tabIndex={0}
        aria-label="Captured page content"
      >
        {(source.capture?.screenshot || source.capture?.screenshotError) && (
          <div className="web-page-panel-screenshot">
            <CaptureScreenshot
              url={source.capture.screenshot?.url ?? ""}
              title={webPageTitle(source)}
            />
          </div>
        )}
        {source.capture &&
        (source.capture.content !== undefined ||
          source.capture.data !== undefined) ? (
          <CaptureContent
            content={source.capture.content}
            data={source.capture.data}
            table={source.capture.table}
            extractionFormat={source.capture.extractionFormat}
          />
        ) : (
          <p className="web-page-empty">
            {source.status === "failed"
              ? "The page could not be captured. Use Retry to fetch it again."
              : source.status === "ready"
                ? "No readable content was returned."
                : "Fetching page content…"}
          </p>
        )}
      </div>
    </aside>
  );
}
