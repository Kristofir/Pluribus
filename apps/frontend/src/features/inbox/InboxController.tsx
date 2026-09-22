import { useLayoutEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { Button } from "@/components/ui/Button";
import { InboxPanel } from "./InboxPanel";
export function InboxController({
  workspaceId,
  onOpenDraft,
  onClose,
  paused = false,
  active = true,
}: {
  workspaceId: Id<"workspaces">;
  onOpenDraft: (
    documentId: Id<"documents">,
    threadId: Id<"inboxThreads">,
    title: string,
  ) => Promise<void>;
  onClose: () => void;
  paused?: boolean;
  active?: boolean;
}) {
  const inbox = useRetainedQuery(api.Inbox.list, { workspaceId }),
    refresh = useMutation(api.Inbox.refresh),
    retryProvisioning = useMutation(api.Inbox.retryProvisioning),
    draft = useMutation(api.Inbox.draft);
  const [selected, setSelected] = useState<string>(),
    [error, setError] = useState<string>(),
    [busy, setBusy] = useState(false);
  const opening = useRef(0);
  useLayoutEffect(() => {
    // Leaving and returning cannot revive an earlier draft request.
    opening.current++;
    return () => {
      opening.current++;
    };
  }, [active, paused]);
  const unconfigured = inbox.data?.status === "unconfigured";
  const provisioning = inbox.data?.provisioning;
  const settingUp =
    provisioning?.status === "pending" ||
    provisioning?.status === "provisioning";
  const setupFailed = provisioning?.status === "failed";
  const canSetUp = setupFailed || (unconfigured && !provisioning);
  const setupTitle = settingUp
    ? "Setting up inbox…"
    : setupFailed
      ? "Inbox setup failed"
      : "Inbox not set up";
  return (
    <InboxPanel
      draftDisabled={
        busy ||
        paused ||
        inbox.failed ||
        settingUp ||
        setupFailed ||
        unconfigured
      }
      emptyState={
        settingUp || setupFailed || unconfigured ? (
          <div className="p-6">
            <h3 className="font-medium">{setupTitle}</h3>
            <p className="text-sm text-muted-fg mt-2">
              {settingUp
                ? "Your workspace inbox is being created. You can keep working while setup finishes."
                : setupFailed
                  ? "Your documents are unaffected. Retry setup to connect this workspace’s inbox."
                  : "This workspace needs its own inbox before it can receive messages."}
            </p>
          </div>
        ) : undefined
      }
      threads={inbox.data?.threads ?? []}
      selectedId={selected}
      loading={!inbox.data && !inbox.failed}
      error={
        inbox.failed
          ? "Inbox unavailable. Your open drafts remain mounted."
          : undefined
      }
      onSelect={(id) => {
        opening.current++;
        setSelected(id);
      }}
      onClose={onClose}
      onOpenDraft={(thread) => {
        if (
          busy ||
          paused ||
          !active ||
          settingUp ||
          setupFailed ||
          unconfigured
        )
          return;
        const request = ++opening.current;
        setBusy(true);
        setError(undefined);
        void draft({ threadId: thread.id as Id<"inboxThreads"> })
          .then((id) =>
            request === opening.current
              ? onOpenDraft(
                  id,
                  thread.id as Id<"inboxThreads">,
                  inbox.data?.threads.find((t) => t.id === thread.id)
                    ?.subject ?? "Reply",
                )
              : undefined,
          )
          .catch(
            () =>
              request === opening.current &&
              setError(
                "The reply draft could not open. Try again; existing drafts are retained.",
              ),
          )
          .finally(() => setBusy(false));
      }}
      integrationNotice={
        <div className="space-y-2">
          {inbox.data?.address && !inbox.failed && !paused && (
            <div className="space-y-1">
              <p className="font-medium">Inbox address</p>
              <p className="select-text break-all">{inbox.data.address}</p>
              <p className="text-muted-fg">
                Send mail to this address, then refresh the inbox.
              </p>
            </div>
          )}
          {settingUp && <p role="status">Setting up your workspace inbox…</p>}
          {provisioning?.error && <p role="alert">{provisioning.error}</p>}
          {!settingUp && !setupFailed && inbox.data?.error && (
            <p role="alert">{inbox.data.error}</p>
          )}
          {canSetUp && (
            <Button
              intent="outline"
              size="sm"
              isDisabled={paused || busy || inbox.failed}
              onPress={async () => {
                setError(undefined);
                setBusy(true);
                try {
                  await retryProvisioning({ workspaceId });
                } catch {
                  setError("Inbox setup could not start. Try again.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {setupFailed ? "Retry inbox setup" : "Set up inbox"}
            </Button>
          )}
          {error && <p role="alert">{error}</p>}
          {busy && <p role="status">Updating inbox…</p>}
          {!unconfigured && !settingUp && !setupFailed && (
            <Button
              intent="outline"
              size="sm"
              isDisabled={
                paused ||
                busy ||
                inbox.failed ||
                !inbox.data ||
                unconfigured ||
                inbox.data.status === "loading"
              }
              onPress={async () => {
                setError(undefined);
                setBusy(true);
                try {
                  await refresh({ workspaceId });
                } catch {
                  setError(
                    "Inbox refresh could not start. Check mailbox configuration and try again.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {inbox.data?.status === "loading"
                ? "Refreshing inbox…"
                : "Refresh inbox"}
            </Button>
          )}
          {inbox.data?.threads.some((t) => t.truncated) && (
            <p>
              Some conversations are truncated. Review the original inbox before
              replying.
            </p>
          )}
        </div>
      }
    />
  );
}
