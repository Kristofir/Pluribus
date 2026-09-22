import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
export type MailMessage = {
  id: string;
  from: string;
  to: readonly string[];
  subject?: string;
  text: string;
  sentAt?: string;
};
export type ThreadView = {
  id: string;
  workspaceId: string;
  messages: readonly MailMessage[];
  draftDocumentId?: string;
  subject?: string;
};
export function InboxPanel({
  threads,
  selectedId,
  loading,
  error,
  onSelect,
  onOpenDraft,
  onClose,
  integrationNotice,
  draftDisabled = false,
  emptyState,
}: {
  threads: readonly ThreadView[];
  selectedId?: string;
  loading: boolean;
  error?: string;
  onSelect: (id: string) => void;
  onOpenDraft: (thread: ThreadView) => void;
  onClose: () => void;
  integrationNotice?: ReactNode;
  draftDisabled?: boolean;
  emptyState?: ReactNode;
}) {
  const heading = useId();
  const selected = threads.find((thread) => thread.id === selectedId);
  return (
    <aside
      aria-labelledby={heading}
      className="h-full flex min-h-0 flex-col text-fg bg-overlay"
    >
      <header className="flex justify-between gap-4 border-b border-border p-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-fg mb-2">
            Workspace mail
          </p>
          <h2 id={heading} tabIndex={-1} className="text-xl font-semibold">
            Inbox
          </h2>
        </div>
        <Button intent="plain" size="sm" onPress={onClose}>
          Close ×
        </Button>
      </header>
      {integrationNotice && (
        <div role="status" className="p-4 border-b border-border text-sm">
          {integrationNotice}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        {error ? (
          <p role="alert" className="p-5">
            {error}
          </p>
        ) : loading ? (
          <p role="status" className="p-5 text-muted-fg">
            Loading messages…
          </p>
        ) : threads.length === 0 ? (
          (emptyState ?? (
            <div className="p-6">
              <h3 className="font-medium">No messages yet</h3>
              <p className="text-sm text-muted-fg mt-2">
                Messages will appear here when the connected inbox receives
                them.
              </p>
            </div>
          ))
        ) : (
          <>
            <nav
              aria-label="Email threads"
              className="border-b border-border p-3 space-y-1"
            >
              {threads.map((thread) => {
                const last = thread.messages.at(-1);
                return (
                  <Button
                    key={thread.id}
                    intent={thread.id === selectedId ? "secondary" : "plain"}
                    onPress={() => onSelect(thread.id)}
                    aria-pressed={thread.id === selectedId}
                    className="w-full justify-start text-left h-auto py-3"
                  >
                    <span className="min-w-0 block">
                      <span className="block font-medium truncate">
                        {thread.subject ||
                          last?.subject ||
                          "Untitled conversation"}
                      </span>
                      <span className="block text-xs text-muted-fg truncate">
                        {last?.from ?? "No messages"}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </nav>
            {selected ? (
              <section
                aria-label="Selected conversation"
                className="p-5 space-y-5"
              >
                <div className="flex justify-between items-center gap-3">
                  <h3 className="font-semibold">Conversation</h3>
                  <Badge intent="secondary">
                    {selected.messages.length}{" "}
                    {selected.messages.length === 1 ? "message" : "messages"}
                  </Badge>
                </div>
                {selected.messages.map((message) => (
                  <article
                    key={message.id}
                    className="border border-border rounded-xl p-4"
                  >
                    <header className="text-xs space-y-1 mb-4 break-words">
                      <p>
                        <strong>From</strong> {message.from}
                      </p>
                      <p>
                        <strong>To</strong> {message.to.join(", ")}
                      </p>
                      {message.sentAt && (
                        <p className="text-muted-fg">{message.sentAt}</p>
                      )}
                    </header>
                    <div className="whitespace-pre-wrap break-words text-sm leading-6">
                      {message.text}
                    </div>
                  </article>
                ))}
                <Button
                  isDisabled={draftDisabled}
                  onPress={() => onOpenDraft(selected)}
                >
                  {selected.draftDocumentId
                    ? "Open reply draft"
                    : "Start reply draft"}
                </Button>
              </section>
            ) : (
              <p className="p-5 text-sm text-muted-fg">
                Choose a conversation to read and reply.
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
