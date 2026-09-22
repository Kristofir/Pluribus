import { useCardEntrance } from "../../hooks/UseCardEntrance";
import "../../styles/CanvasCard.css";
import { useLayoutEffect, useRef } from "react";
import { CaptureScreenshot } from "./CaptureScreenshot";
import { capturePreview } from "./CapturePreview";
import { CaptureText } from "./CaptureContent";
import { WebPageFetching } from "./WebPageFetching";
import {
  captureUrl,
  webPageContent,
  webPageTitle,
  type WebPageView,
} from "./WebPageView";
import "./WebPages.css";
/** Canvas wrapper owns geometry and gestures; capture controls live in the panel. */
export function WebPageCard({
  source,
  onOpen,
  onContentHeight,
}: {
  source: WebPageView;
  onOpen: () => void;
  onContentHeight?: (height: number) => void;
}) {
  const entrance = useCardEntrance();
  const card = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = card.current;
    const body = element?.querySelector<HTMLElement>(".web-page-card-body");
    if (!element || !body || !onContentHeight) return;
    const measure = () => {
      const style = getComputedStyle(element);
      onContentHeight(
        Math.ceil(
          body.offsetHeight +
            parseFloat(style.paddingTop) +
            parseFloat(style.paddingBottom) +
            parseFloat(style.borderTopWidth) +
            parseFloat(style.borderBottomWidth),
        ),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    measure();
    return () => observer.disconnect();
  }, [onContentHeight, source.status, source.hasCapture]);
  const original = source.preview ?? webPageContent(source);
  const content = capturePreview(original);
  const retained = source.hasCapture ?? !!source.capture;
  const url = captureUrl(source);
  const hasScreenshot = !!(
    source.capture?.screenshot || source.capture?.screenshotError
  );
  const fetching = source.status === "queued" || source.status === "fetching";
  return (
    <section
      style={entrance}
      ref={card}
      className={`canvas-card web-page-card${hasScreenshot ? " web-page-card-has-screenshot" : ""}`}
      aria-label={`Web page: ${webPageTitle(source)}`}
      aria-busy={fetching}
    >
      <div className="web-page-card-body">
        {fetching && !retained ? (
          <div className="web-page-fetching-open">
            <WebPageFetching />
          </div>
        ) : (
          <>
            {hasScreenshot && (
              <CaptureScreenshot
                url={source.capture?.screenshot?.url ?? ""}
                title={webPageTitle(source)}
              />
            )}
            <span className="web-page-card-label">
              {fetching ? "Web Content · Refreshing…" : "Web Content"}
            </span>
            <div className="web-page-card-title">
              <div className="web-page-open">
                <span>{webPageTitle(source)}</span>
              </div>
              <p className="web-page-url" title={url}>
                {url}
              </p>
            </div>
            <div className="web-page-preview">
              {source.capture?.extractionFormat === "inferred-v1" ? (
                <span>Extracted content · View details for results.</span>
              ) : source.capture?.table ? (
                <span>
                  Extracted table · {source.capture.table.columns.join(", ")}.
                  View details for rows.
                </span>
              ) : content ? (
                <CaptureText text={content} preview />
              ) : original || retained ? (
                "View details for page content."
              ) : source.status === "failed" ? (
                "Could not fetch this page."
              ) : (
                "No readable content was returned."
              )}
            </div>
          </>
        )}
        {!fetching && (
          <button
            type="button"
            className="web-page-details nodrag nopan"
            onClick={onOpen}
          >
            Details
          </button>
        )}
      </div>
    </section>
  );
}
