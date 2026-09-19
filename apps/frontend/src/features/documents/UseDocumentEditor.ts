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
  content,
  extension,
  error,
  clearError,
}: {
  id: Id<"documents">;
  participate: boolean;
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
  useLayoutEffect(() => {
    if (!editor) return;
    const capture = () => {
      if (editor.isDestroyed) return;
      const pending = sendableSteps(editor.state) !== null;
      onPendingChange?.(pending);
      recoveryStore.getState().capture(
        syncId,
        pending
          ? {
              json: JSON.stringify(editor.getJSON(), null, 2),
              text: editor.getText(),
              version: getVersion(editor.state),
            }
          : null,
      );
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
    retry,
    showAuthors,
    setShowAuthors,
    moveSource,
    setMoveSource,
    moveError,
    move,
  };
}
