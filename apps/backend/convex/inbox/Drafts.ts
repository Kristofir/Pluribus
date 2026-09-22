import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireWorkspace } from "../workspaces/Access";
import { createPanelDocument } from "../workspaces/Provisioning";
import { requireDocument } from "../documents/Access";
import { components } from "../_generated/api";
import { mailboxAddress } from "./AgentMail";
import { materialize } from "../documents/Sync";
export async function requireThread(
  ctx: QueryCtx,
  threadId: Id<"inboxThreads">,
) {
  const thread = await ctx.db.get(threadId);
  if (!thread) throw new Error("Thread unavailable");
  await requireWorkspace(ctx, thread.workspaceId);
  const inbox = await ctx.db.get(thread.inboxId);
  if (!inbox || inbox.workspaceId !== thread.workspaceId)
    throw new Error("Thread ownership invalid");
  return thread;
}
export async function openDraft(
  ctx: MutationCtx,
  args: { threadId: Id<"inboxThreads"> },
) {
  const thread = await requireThread(ctx, args.threadId);
  if (thread.draftDocumentId) {
    await savedDraft(ctx, thread._id);
    return thread.draftDocumentId;
  }
  const id = await createPanelDocument(ctx, thread.workspaceId, {
    kind: "reply",
    threadId: thread._id,
  });
  await ctx.db.patch(thread._id, { draftDocumentId: id });
  return id;
}
export async function savedDraft(ctx: QueryCtx, threadId: Id<"inboxThreads">) {
  const thread = await requireThread(ctx, threadId);
  if (!thread.draftDocumentId) throw new Error("Open a reply draft first");
  const document = await requireDocument(ctx, thread.draftDocumentId),
    child = document.element ? await ctx.db.get(document.element) : null;
  if (
    !child ||
    child.role !== "reply" ||
    child.threadId !== threadId ||
    child.documentId !== document._id ||
    child.removed ||
    child.canvas !== thread.workspaceId ||
    document.workspaceId !== thread.workspaceId
  )
    throw new Error("Draft ownership invalid");
  const version = await ctx.runQuery(
    components.prosemirrorSync.lib.latestVersion,
    { id: document._id },
  );
  if (version === null) throw new Error("Draft unavailable");
  const doc = (await materialize(ctx, document._id, version)).doc;
  const received = [...thread.messages]
    .reverse()
    .find((m) => m.direction === "incoming");
  return {
    documentId: document._id,
    generation: child.generation,
    version,
    text: doc.textBetween(0, doc.content.size, "\n\n"),
    reviewedMessageId: received?.id ?? null,
    recipients: received
      ? (received.replyTo?.length ? received.replyTo : [received.from]).map(
          mailboxAddress,
        )
      : [],
  };
}
