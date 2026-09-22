import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { Button } from "@/components/ui/Button";
import "./ChatOverlay.css";

export function ChatOverlay({
  workspaceId,
  paused,
}: {
  workspaceId: Id<"workspaces">;
  paused: boolean;
}) {
  const messages = useQuery(api.Chat.messages, { workspaceId });
  const send = useAction(api.Chat.send);
  const clearChat = useMutation(api.Chat.clear);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string>();
  const scroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
  }, [open, messages?.length, sending]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || clearing || paused) return;
    setOpen(true);
    setDraft("");
    setError(undefined);
    setSending(true);
    try {
      await send({ workspaceId, text });
    } catch {
      setDraft(text);
      setError("The agent is unavailable. Try again.");
    } finally {
      setSending(false);
    }
  };

  const reset = async () => {
    if (clearing || paused) return;
    setClearing(true);
    setError(undefined);
    try {
      await clearChat({ workspaceId });
      setDraft("");
    } catch {
      setError("The chat could not be cleared. Try again.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <section
      className={`canvas-chat${open ? " is-open" : ""}`}
      aria-label="Workspace agent"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      {open && (
        <>
          <header className="canvas-chat-header">
            <div>
              <strong>Workspace agent</strong>
            </div>
            <div className="canvas-chat-header-actions">
              {!!messages?.length && (
                <Button
                  intent="plain"
                  size="sm"
                  onPress={() => void reset()}
                  isDisabled={paused || sending || clearing}
                  aria-label="Clear agent chat"
                >
                  {clearing ? "Clearing…" : "Clear"}
                </Button>
              )}
              <Button
                intent="plain"
                size="sq-sm"
                onPress={() => setOpen(false)}
                aria-label="Close workspace agent"
              >
                ×
              </Button>
            </div>
          </header>
          <div className="canvas-chat-messages" ref={scroll} aria-live="polite">
            {!messages && <p className="canvas-chat-muted">Loading chat…</p>}
            {messages?.length === 0 && (
              <div className="canvas-chat-welcome">
                <p>Tell me what to create or how to arrange the board.</p>
                <p className="canvas-chat-muted">
                  Try “Create three notes for launch risks” or “Arrange these
                  cards in a row.”
                </p>
              </div>
            )}
            {messages?.map((message) => (
              <article
                key={message.id}
                className={`canvas-chat-message is-${message.role}${
                  message.status === "failed" ? " is-failed" : ""
                }`}
              >
                <span>
                  {message.role === "assistant"
                    ? "Agent"
                    : message.mine
                      ? "You"
                      : "Collaborator"}
                </span>
                <p>{message.text}</p>
              </article>
            ))}
            {sending && (
              <div className="canvas-chat-thinking" role="status">
                <i />
                <i />
                <i />
                <span className="sr-only">Agent is working</span>
              </div>
            )}
          </div>
        </>
      )}
      <form
        className="canvas-chat-composer"
        onSubmit={(event) => void submit(event)}
      >
        {error && <p role="alert">{error}</p>}
        <div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => {
              if (messages?.length) setOpen(true);
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask the agent…"
            rows={1}
            maxLength={4000}
            disabled={paused || sending || clearing}
            aria-label="Message workspace agent"
          />
          <Button
            type="submit"
            intent="primary"
            size="sq-sm"
            isDisabled={paused || sending || clearing || !draft.trim()}
            aria-label="Send message"
          >
            ↑
          </Button>
        </div>
      </form>
    </section>
  );
}
