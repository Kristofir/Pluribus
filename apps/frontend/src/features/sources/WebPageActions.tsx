import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  canRecoverWebPage,
  webPageRequestError,
  type WebPageActionsProps,
} from "./WebPageView";
export function WebPageActions({
  source,
  disabled = false,
  onRefresh,
  onRecover,
}: WebPageActionsProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setError(undefined);
    setNotice(undefined);
    setNow(Date.now());
    if (
      source.deadlineAt === undefined ||
      !["queued", "fetching"].includes(source.status)
    )
      return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(2147483647, Math.max(0, source.deadlineAt - Date.now() + 10)),
    );
    return () => clearTimeout(timer);
  }, [source.id, source.revision, source.status, source.deadlineAt]);
  const recoverable = !!onRecover && canRecoverWebPage(source, now);
  const busy =
    refreshing || source.status === "queued" || source.status === "fetching";
  return (
    <div className="web-page-actions nodrag nopan">
      <Button
        size="sm"
        intent="outline"
        isDisabled={disabled || busy}
        onPress={async () => {
          if (disabled || busy) return;
          setRefreshing(true);
          setError(undefined);
          setNotice(undefined);
          try {
            await onRefresh();
          } catch (error) {
            setError(webPageRequestError(error));
          } finally {
            setRefreshing(false);
          }
        }}
      >
        {busy ? "Fetching…" : source.status === "failed" ? "Retry" : "Refresh"}
      </Button>
      {recoverable && (
        <div className="web-page-recover">
          <p>
            {source.deadlineAt === undefined
              ? "This older request has no deadline. If it appears stuck, stop waiting to enable a manual retry."
              : "This request is past its deadline. Stop waiting to enable a manual retry."}{" "}
            Late results from this request will be ignored.
          </p>
          <Button
            size="sm"
            intent="outline"
            isDisabled={disabled || refreshing}
            onPress={async () => {
              if (disabled || refreshing || !onRecover) return;
              setRefreshing(true);
              setError(undefined);
              setNotice(undefined);
              try {
                const recovered = await onRecover();
                setNotice(
                  recovered
                    ? "Request stopped. Retry when ready."
                    : "Nothing changed. The request may have completed or changed; review its current status.",
                );
              } catch (error) {
                setError(webPageRequestError(error));
              } finally {
                setRefreshing(false);
              }
            }}
          >
            Stop waiting
          </Button>
        </div>
      )}
      {notice && (
        <p className="web-page-error" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="web-page-error">
          {error}
        </p>
      )}
    </div>
  );
}
