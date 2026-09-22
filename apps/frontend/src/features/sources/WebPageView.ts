/** Read-only projection of the existing source record; never a second document. */
export type WebPageView = {
  id: string;
  url: string;
  revision?: number;
  deadlineAt?: number;
  prompt?: string;
  table?: { columns: string[] };
  title?: string;
  preview?: string;
  hasCapture?: boolean;
  capturedAt?: number;
  status: "queued" | "fetching" | "ready" | "failed";
  capture?: {
    content?: string;
    data?: string;
    capturedAt?: number;
    url?: string;
    prompt?: string;
    table?: { columns: string[] };
    extractionFormat?: "inferred-v1";
    screenshot?: { url: string | null; width: number; height: number };
    screenshotError?: string;
  };
  error?: string;
};
export type WebPageActionsProps = {
  source: WebPageView;
  disabled?: boolean;
  onRefresh: () => Promise<void>;
  onRecover?: () => Promise<boolean>;
};
export function webPageUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}
export function webPageTitle(source: WebPageView) {
  return (
    source.title?.trim() ||
    webPageUrl(captureUrl(source))?.hostname ||
    "Web page"
  );
}
export function webPageContent(source: WebPageView) {
  return source.capture?.data ?? source.capture?.content ?? "";
}
export function webPageStatus(source: WebPageView) {
  if (source.status === "queued" || source.status === "fetching")
    return (source.hasCapture ?? !!source.capture)
      ? "Refreshing…"
      : "Fetching…";
  if (source.status === "failed")
    return (source.hasCapture ?? !!source.capture)
      ? "Refresh failed · previous capture retained"
      : "Capture failed";
  return "Captured";
}

export function captureUrl(source: WebPageView) {
  return source.capture?.url ?? source.url;
}
export function capturePrompt(source: WebPageView) {
  return (source.hasCapture ?? !!source.capture)
    ? source.capture?.prompt
    : source.prompt;
}
export function canRecoverWebPage(source: WebPageView, now: number) {
  return (
    source.revision !== undefined &&
    (source.status === "queued" || source.status === "fetching") &&
    (source.deadlineAt === undefined || now >= source.deadlineAt)
  );
}
export function webPageRequestError(error: unknown) {
  const data =
    error && typeof error === "object" && "data" in error ? error.data : null;
  if (data && typeof data === "object" && "code" in data) {
    if (data.code === "SOURCE_EXTRACTION_INTENT_REQUIRED")
      return "Describe the content you want extracted. Format alone does not identify which information to retrieve.";
    if (data.code === "SOURCE_REVISION_CONFLICT")
      return "This page changed in another session. Review the latest request before trying again.";
    if (data.code === "SOURCE_REQUEST_ACTIVE")
      return "A different request is already running. Wait for it to finish before trying again.";
  }
  return "The request could not be confirmed. Check the current status before trying again.";
}
