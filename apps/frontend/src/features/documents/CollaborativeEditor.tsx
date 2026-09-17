import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Content,
  type AnyExtension,
} from "@tiptap/react";
import { sendableSteps, getVersion } from "prosemirror-collab";
import { syncExtension } from "@convex-dev/prosemirror-sync/tiptap";
import { useConvex } from "convex/react";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { usePresence } from "../presence/UsePresence";
import { PresenceRoster } from "../presence/PresenceRoster";
import { createDocumentPresence } from "./DocumentPresence";
import { documentExtensions } from "./EditorSchema";
import {
  createAuthorshipExtension,
  moveSelection,
} from "./AuthorshipExtension";
import {
  authorshipTransport,
  useAuthorship,
  useAuthorProfiles,
  type AuthorSession,
} from "./UseAuthorship";
import { useDocumentConnection } from "./UseDocument";

export function CollaborativeEditor({
  id,
  participate,
  embedded = false,
  generation,
  suspended = false,
  paused = false,
  onPendingChange,
}: {
  id: Id<"documents">;
  participate: boolean;
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
  embedded,
  content,
  extension,
  error,
  clearError,
}: {
  id: Id<"documents">;
  participate: boolean;
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
  const authorship = useMemo(
    () =>
      authorSession ? createAuthorshipExtension(authorSession.author) : null,
    [authorSession],
  );
  const [showAuthors, setShowAuthors] = useState(false);
  const [moveSource, setMoveSource] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const connected = useDocumentConnection();
  const convex = useConvex();
  const presence = usePresence({ kind: "document", id }, participate);
  const emit = useRef(presence.emit);
  emit.current = presence.emit;
  const collaborator = useMemo(
    () =>
      createDocumentPresence(
        (version) =>
          convex.query(api.Documents.getSteps, { id: syncId, version }),
        (event) => emit.current(event),
      ),
    [convex, syncId],
  );
  useEffect(() => {
    collaborator.receive(
      presence.members,
      presence.activities,
      presence.id,
      presence.show,
    );
  }, [
    collaborator,
    presence.members,
    presence.activities,
    presence.id,
    presence.show,
  ]);
  useEffect(() => {
    collaborator.localSelection();
  }, [collaborator, presence.id]);
  const versionQuery = useRetainedQuery(api.Documents.latestVersion, {
    id: syncId,
  });
  const latest = versionQuery.data;
  const readPaused = paused || versionQuery.failed;
  const editor = useEditor({
    extensions: [
      ...documentExtensions,
      extension,
      collaborator.extension,
      ...(authorship ? [authorship.extension] : []),
    ],
    content,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Shared document",
        "aria-multiline": "true",
      },
    },
  });
  useEffect(() => {
    collaborator.attach(editor);
    return () => collaborator.attach(null);
  }, [collaborator, editor]);
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            pending: sendableSteps(editor.state) !== null,
            version: getVersion(editor.state),
            bold: editor.isActive("bold"),
            heading: editor.isActive("heading", { level: 2 }),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
            authorIds: (() => {
              const ids = new Set<string>();
              editor.state.doc.descendants((node) => {
                const id = node.marks.find(
                  (mark) => mark.type.name === "authorship",
                )?.attrs.author;
                if (typeof id === "string") ids.add(id);
              });
              return JSON.stringify([...ids].sort());
            })(),
          }
        : null,
  });
  const profiles = useAuthorProfiles(
    syncId,
    state?.authorIds ?? "[]",
    !!authorSession,
  );
  useEffect(() => {
    if (editor && authorship)
      authorship.setDisplay(
        editor,
        showAuthors,
        new Map(
          profiles.map((row) => [
            row.id,
            `${row.label} (${row.kind === "guest" ? "unverified guest" : row.kind})`,
          ]),
        ),
      );
  }, [editor, authorship, showAuthors, profiles]);
  useEffect(() => {
    if (!editor || !moveSource) return;
    const changed = ({
      transaction,
    }: {
      transaction: import("@tiptap/pm/state").Transaction;
    }) => {
      if (transaction.docChanged) {
        setMoveSource(null);
        setMoveError("Text changed. Select the passage to move again.");
      }
    };
    editor.on("transaction", changed);
    return () => {
      editor.off("transaction", changed);
    };
  }, [editor, moveSource]);
  const [recovery, setRecovery] = useState<string | null>(null);
  useEffect(() => {
    onPendingChange?.(state?.pending ?? false);
  }, [state?.pending, onPendingChange]);
  useEffect(() => {
    if (suspended && editor)
      setRecovery(
        (value) => value ?? JSON.stringify(editor.getJSON(), null, 2),
      );
  }, [suspended, editor]);
  const [blocked, setBlocked] = useState(false);
  useBlocker({
    shouldBlockFn: () => {
      const pending = !!editor && sendableSteps(editor.state) !== null;
      if (pending) setBlocked(true);
      return pending;
    },
    enableBeforeUnload: () => !!editor && sendableSteps(editor.state) !== null,
  });
  useEffect(() => {
    // Keep online editing/undo available so a rejected edit can be corrected.
    editor?.setEditable(connected && !suspended && !readPaused);
  }, [editor, connected, suspended, readPaused]);
  useEffect(() => {
    if (!state?.pending) setBlocked(false);
  }, [state?.pending]);
  function retry() {
    clearError();
    // Ask the component to retry its native sync loop, preserving unconfirmed steps.
    if (editor)
      editor.emit("update", {
        editor,
        transaction: editor.state.tr,
        appendedTransactions: [],
      });
  }
  useEffect(() => {
    if (connected && editor && !suspended && !readPaused)
      editor.emit("update", {
        editor,
        transaction: editor.state.tr,
        appendedTransactions: [],
      });
  }, [connected, editor, suspended, readPaused]);
  const saved =
    !!state &&
    !state.pending &&
    latest !== undefined &&
    latest !== null &&
    state.version >= latest;
  const status = readPaused
    ? "Updates unavailable — editing paused; local edits retained"
    : !connected
      ? "Disconnected — editing paused"
      : error
        ? "Sync error — edits retained in this tab"
        : saved
          ? "Saved"
          : "Saving…";
  const disabled = !editor || !connected || suspended || readPaused;
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
      {authorship && (
        <div className="authorship-controls">
          <label>
            <input
              type="checkbox"
              checked={showAuthors}
              onChange={(event) => setShowAuthors(event.target.checked)}
            />{" "}
            Show authors
          </label>
          <button
            disabled={disabled || !!state?.pending}
            onClick={() => {
              if (!editor) return;
              setMoveError(null);
              if (!moveSource) {
                const { from, to } = editor.state.selection;
                if (from === to) {
                  setMoveError("Select text to move first.");
                  return;
                }
                setMoveSource({ from, to });
              } else {
                try {
                  if (
                    !moveSelection(
                      editor,
                      moveSource,
                      editor.state.selection.from,
                    )
                  ) {
                    setMoveError(
                      "Place the caret outside the selected passage.",
                    );
                    return;
                  }
                  setMoveSource(null);
                  setMoveError(null);
                } catch {
                  setMoveError(
                    "That passage does not fit here. Choose a compatible text or block boundary.",
                  );
                }
              }
            }}
          >
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
