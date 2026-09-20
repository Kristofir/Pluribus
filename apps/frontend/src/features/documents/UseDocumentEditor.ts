import { useLayoutEffect, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import {
  useEditor,
  useEditorState,
  type Content,
  type AnyExtension,
} from "@tiptap/react";
import { sendableSteps, getVersion } from "prosemirror-collab";
import { useConvex } from "convex/react";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { usePresence } from "../presence/UsePresence";
import { createDocumentPresence } from "./DocumentPresence";
import { documentExtensions } from "./EditorSchema";
import {
  createAuthorshipExtension,
  moveSelection,
} from "./AuthorshipExtension";
import { useAuthorProfiles, type AuthorSession } from "./UseAuthorship";
import { useDocumentConnection } from "./UseDocument";
import { useDocumentRecovery } from "./DocumentRecoveryProvider";
/** Own the mounted editor, subscriptions, pending edits and recovery together. */
export function useDocumentEditor({
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
}: {
  id: Id<"documents">;
  participate: boolean;
  interactionEnabled: boolean;
  focusPoint?: { x: number; y: number } | null;
  authorSession: AuthorSession | null;
  syncId: string;
  suspended: boolean;
  paused: boolean;
  onPendingChange?: (pending: boolean) => void;
  content: Content;
  extension: AnyExtension;
  error: boolean;
  clearError: () => void;
}) {
  const recoveryStore = useDocumentRecovery();
  const authorship = useMemo(
    () =>
      authorSession ? createAuthorshipExtension(authorSession.author, authorSession.paragraphs) : null,
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
  const authorIdsFor = useMemo(() => {
    const cache = new WeakMap<import("@tiptap/pm/model").Node, string>();
    return (doc: import("@tiptap/pm/model").Node) => {
      const cached = cache.get(doc);
      if (cached !== undefined) return cached;
      const ids = new Set<string>();
      doc.descendants((node) => {
        const id = node.marks.find((mark) => mark.type.name === "authorship")
          ?.attrs.author;
        if (typeof id === "string") ids.add(id);
      });
      const result = JSON.stringify([...ids].sort());
      cache.set(doc, result);
      return result;
    };
  }, []);
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
            authorIds: authorIdsFor(editor.state.doc),
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
  useLayoutEffect(() => {
    if (!editor) return;
    let lastPending: boolean | undefined;
    let lastDoc: typeof editor.state.doc | undefined;
    let lastCopy: { json: string; text: string } | undefined;
    let lastVersion: number | undefined;
    const capture = () => {
      if (editor.isDestroyed) return;
      const pending = sendableSteps(editor.state) !== null;
      const version = getVersion(editor.state);
      const doc = editor.state.doc;
      if (pending !== lastPending) onPendingChange?.(pending);
      // Metadata/selection transactions do not change the recovery copy. An
      // acknowledgement can change pending/version without changing the doc.
      if (pending) {
        if (doc !== lastDoc || !lastCopy) {
          lastCopy = {
            json: JSON.stringify(editor.getJSON(), null, 2),
            text: editor.getText(),
          };
        }
        if (!lastPending || doc !== lastDoc || version !== lastVersion)
          recoveryStore.getState().capture(syncId, { ...lastCopy, version });
      } else if (lastPending !== false) {
        recoveryStore.getState().capture(syncId, null);
      }
      lastPending = pending;
      lastVersion = version;
      lastDoc = doc;
      if (!pending) lastCopy = undefined;
    };
    const detach = () => {
      capture();
      recoveryStore.getState().detach(syncId);
      onPendingChange?.(false);
    };
    capture();
    editor.on("transaction", capture);
    editor.on("destroy", detach);
    return () => {
      detach();
      editor.off("transaction", capture);
      editor.off("destroy", detach);
    };
  }, [editor, syncId, recoveryStore, onPendingChange]);
  const [recovery, setRecovery] = useState<string | null>(null);
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
  const appliedFocus = useRef<{
    editor: typeof editor;
    point: typeof focusPoint;
  } | null>(null);
  useLayoutEffect(() => {
    if (!editor) return;
    const enabled =
      connected && !suspended && !readPaused && interactionEnabled;
    editor.setEditable(enabled);
    if (!enabled && editor.isFocused) editor.commands.blur();
    if (
      enabled &&
      focusPoint &&
      (appliedFocus.current?.editor !== editor ||
        appliedFocus.current?.point !== focusPoint)
    ) {
      appliedFocus.current = { editor, point: focusPoint };
      const bounds = editor.view.dom.getBoundingClientRect();
      const position = editor.view.posAtCoords({
        left: Math.max(
          bounds.left + 1,
          Math.min(focusPoint.x, bounds.right - 1),
        ),
        top: Math.max(
          bounds.top + 1,
          Math.min(focusPoint.y, bounds.bottom - 1),
        ),
      });
      editor.commands.setTextSelection(
        position?.pos ?? editor.state.doc.content.size,
      );
      editor.view.focus();
    }
  }, [
    editor,
    connected,
    suspended,
    readPaused,
    interactionEnabled,
    focusPoint,
  ]);
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
  // Snapshot maintenance can fail after every text step is acknowledged.
  // A confirmed current version is sufficient evidence that text is safe.
  const syncError = error && !saved;
  useEffect(() => {
    if (error && saved && connected && !readPaused) clearError();
  }, [error, saved, connected, readPaused, clearError]);
  const status = readPaused
    ? "Updates unavailable — editing paused; local edits retained"
    : !connected
      ? "Disconnected — editing paused"
      : syncError
        ? state?.pending
          ? "Sync error — edits retained in this tab"
          : "Sync error — document updates unavailable"
        : saved
          ? "Saved"
          : "Saving…";
  const disabled = !editor || !connected || suspended || readPaused;
  function move() {
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
        if (!moveSelection(editor, moveSource, editor.state.selection.from)) {
          setMoveError("Place the caret outside the selected passage.");
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
  }
  return {
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
    syncError,
    retry,
    showAuthors,
    setShowAuthors,
    moveSource,
    setMoveSource,
    moveError,
    move,
  };
}
