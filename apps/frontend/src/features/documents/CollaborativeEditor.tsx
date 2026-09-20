import { useEffect, useMemo, useState } from "react";
import { EditorContent, type Content, type AnyExtension } from "@tiptap/react";
import { syncExtension } from "@convex-dev/prosemirror-sync/tiptap";
import { useConvex } from "convex/react";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { PresenceRoster } from "../presence/PresenceRoster";
import {
  authorshipTransport,
  useAuthorship,
  type AuthorSession,
} from "./UseAuthorship";
import { useDocumentEditor } from "./UseDocumentEditor";

export function CollaborativeEditor({
  id,
  participate,
  interactionEnabled = true,
  focusPoint,
  embedded = false,
  generation,
  suspended = false,
  paused = false,
  onPendingChange,
}: {
  id: Id<"documents">;
  participate: boolean;
  interactionEnabled?: boolean;
  focusPoint?: { x: number; y: number } | null;
  embedded?: boolean;
  generation?: number;
  suspended?: boolean;
  paused?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [error, setError] = useState(false);
  const syncId = generation === undefined ? id : `${id}:${generation}`;
  const convex = useConvex();
  const author = useAuthorship(syncId, !suspended);
  const transport = useMemo(
    () =>
      author.session ? authorshipTransport(convex, author.session) : convex,
    [convex, author.session],
  );
  const [initial, setInitial] = useState<{
    id: string;
    content: Content;
    version: number;
  } | null>(null);
  const seed = initial?.id === syncId ? initial : null;
  const snapshot = useRetainedQuery(
    api.Documents.getSnapshot,
    seed ? "skip" : { id: syncId },
  );
  useEffect(() => {
    if (!seed && snapshot.data?.content)
      setInitial({
        id: syncId,
        content: JSON.parse(snapshot.data.content),
        version: snapshot.data.version,
      });
  }, [seed, snapshot.data, syncId]);
  // Use the official protocol extension directly; only snapshot loading is app-owned.
  const extension = useMemo(
    () =>
      seed && (suspended || author.session)
        ? syncExtension(
            transport,
            syncId,
            api.Documents,
            {
              initialContent: seed.content,
              initialVersion: seed.version,
            },
            { onSyncError: () => setError(true) },
          )
        : null,
    [transport, syncId, seed, suspended, author.session],
  );
  if (author.failed && !suspended)
    return (
      <p role="alert">
        Could not establish author identity. Reload to retry; existing text is
        unchanged.
      </p>
    );
  if (!seed && snapshot.data?.content === null)
    return <p role="alert">Document content is unavailable.</p>;
  if (!seed || !extension)
    return (
      <p role={snapshot.failed ? "alert" : "status"}>
        {snapshot.failed
          ? "Document could not load. Other editors and their unsaved work remain open."
          : "Loading document…"}
      </p>
    );
  return (
    <DocumentEditor
      id={id}
      authorSession={author.session}
      syncId={syncId}
      suspended={suspended}
      paused={paused}
      onPendingChange={onPendingChange}
      participate={participate}
      interactionEnabled={interactionEnabled}
      focusPoint={focusPoint}
      embedded={embedded}
      content={seed.content}
      extension={extension}
      error={error}
      clearError={() => setError(false)}
    />
  );
}

function DocumentEditor({
  id,
  authorSession,
  syncId,
  suspended,
  paused,
  onPendingChange,
  participate,
  interactionEnabled,
  focusPoint,
  embedded,
  content,
  extension,
  error,
  clearError,
}: {
  id: Id<"documents">;
  participate: boolean;
  interactionEnabled: boolean;
  focusPoint?: { x: number; y: number } | null;
  authorSession: AuthorSession | null;
  embedded: boolean;
  syncId: string;
  suspended: boolean;
  paused: boolean;
  onPendingChange?: (pending: boolean) => void;
  content: Content;
  extension: AnyExtension;
  error: boolean;
  clearError: () => void;
}) {
  const {
    editor,
    presence,
    state,
    authorship,
    recovery,
    blocked,
    disabled,
    readPaused,
    connected,
    status,
    retry,
    showAuthors,
    setShowAuthors,
    moveSource,
    setMoveSource,
    moveError,
    move,
  } = useDocumentEditor({
    id,
    authorSession,
    syncId,
    suspended,
    paused,
    onPendingChange,
    participate,
    interactionEnabled,
    focusPoint,
    content,
    extension,
    error,
    clearError,
  });
  return (
    <>
      {suspended && (
        <div role="alert">
          This document was removed. Saved text is retained; local changes are
          not resubmitted.
          <details>
            <summary>Local recovery copy</summary>
            <textarea
              aria-label="Local recovery copy"
              readOnly
              value={recovery ?? ""}
            />
          </details>
        </div>
      )}
      {participate && !embedded && <PresenceRoster presence={presence} />}
      {!embedded && (
        <div
          className="document-toolbar"
          role="toolbar"
          aria-label="Text formatting"
        >
          <button
            disabled={disabled}
            aria-pressed={state?.bold ?? false}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            Bold
          </button>
          <button
            disabled={disabled}
            aria-pressed={state?.heading ?? false}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            Heading
          </button>
          <button
            disabled={disabled}
            onClick={() => editor?.chain().focus().setParagraph().run()}
          >
            Paragraph
          </button>
          <button
            disabled={disabled}
            aria-pressed={state?.bulletList ?? false}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            Bullet list
          </button>
          <button
            disabled={disabled}
            aria-pressed={state?.orderedList ?? false}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            Numbered list
          </button>
          <button
            disabled={
              disabled || !!(authorSession && state?.pending) || !state?.canUndo
            }
            onClick={() => editor?.chain().focus().undo().run()}
          >
            Undo
          </button>
          <button
            disabled={
              disabled || !!(authorSession && state?.pending) || !state?.canRedo
            }
            onClick={() => editor?.chain().focus().redo().run()}
          >
            Redo
          </button>
        </div>
      )}
      {!embedded && authorship && (
        <div className="authorship-controls">
          <label>
            <input
              type="checkbox"
              checked={showAuthors}
              onChange={(event) => setShowAuthors(event.target.checked)}
            />{" "}
            Show authors
          </label>
          <button disabled={disabled || !!state?.pending} onClick={move}>
            {moveSource ? "Move here" : "Move selection"}
          </button>
          {moveSource && (
            <>
              <span>Place the caret at the destination.</span>
              <button onClick={() => setMoveSource(null)}>Cancel move</button>
            </>
          )}
          {moveError && <span role="alert">{moveError}</span>}
        </div>
      )}
      {(!embedded || readPaused || !connected || error) && (
        <p role="status" className="document-status">
          {status}
        </p>
      )}
      {error && (
        <p role="alert">
          Keep this tab open to preserve pending edits.{" "}
          <button
            disabled={!connected || suspended || readPaused}
            onClick={retry}
          >
            Retry sync
          </button>
        </p>
      )}
      {blocked && (
        <p role="alert">
          Wait for “Saved” before leaving. Your pending edits are still in this
          tab.
        </p>
      )}
      <EditorContent editor={editor} className="document-paper" />
    </>
  );
}
