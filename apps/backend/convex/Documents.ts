import {
  describeDocument,
  readParagraphs,
  linkParagraph as linkParagraphHandler,
} from "./documents/Paragraphs";
import { requireWorkspace } from "./workspaces/Access";
import {
  openAuthorship as openAuthor,
  authorProfiles,
} from "./documents/Authors";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { ensureSharedDocument } from "@pluribus/core/documents/application";
import { documentActor, requireDocument } from "./documents/Access";
import { documentPersistence } from "./documents/Persistence";
import {
  assertVersion,
  submitDocumentSteps,
  submitDocumentSnapshot,
} from "./documents/Sync";

// Explicit public API. String sync IDs are required by the component protocol;
// every endpoint validates them against our documents table before accessing it.
/**
 * Protocol client identifier accepted by ProseMirror collaboration. It associates
 * steps with an editor for acknowledgement/rebasing; it is never an authorization identity.
 */
const clientId = v.union(v.string(), v.number());
/**
 * Initialize or find the shared application document. Core orchestrates the
 * idempotent lookup; the persistence adapter creates metadata and initial content
 * in the same mutation transaction, so concurrent opens cannot split their identity.
 */
export const ensureShared = mutation({
  args: {},
  returns: v.id("documents"),
  handler: async (ctx) => {
    const document = await ensureSharedDocument(
      await documentActor(ctx),
      documentPersistence(ctx),
    );
    const id = ctx.db.normalizeId("documents", document.id);
    if (!id) throw new Error("Invalid document identity");
    return id;
  },
});
/**
 * Load the newest stored snapshot at or before an optional protocol version.
 * The editor uses this as a starting point and replays subsequent steps. Application
 * record existence and access are checked before reading component storage.
 */
export const getSnapshot = query({
  args: { id: v.string(), version: v.optional(v.number()) },
  returns: v.union(
    v.object({ content: v.null() }),
    v.object({ content: v.string(), version: v.number() }),
  ),
  handler: async (ctx, args) => {
    const document = await requireDocument(ctx, args.id);
    if (args.version !== undefined) assertVersion(args.version);
    return ctx.runQuery(components.prosemirrorSync.lib.getSnapshot, {
      ...args,
      id: document._id,
    });
  },
});
/**
 * Reactive protocol-version signal watched by each collaborative editor. A newer
 * version tells clients to fetch/rebase steps. This is not a Convex record version;
 * null represents missing component content, while a missing application record throws.
 */
export const latestVersion = query({
  args: { id: v.string() },
  returns: v.union(v.null(), v.number()),
  handler: async (ctx, args) => {
    const document = await requireDocument(ctx, args.id);
    return ctx.runQuery(components.prosemirrorSync.lib.latestVersion, {
      ...args,
      id: document._id,
    });
  },
});
/**
 * Fetch a bounded batch of accepted steps after the requested protocol version.
 * Client IDs let ProseMirror distinguish its own acknowledgements from remote edits;
 * the returned version marks the end of this batch, not necessarily all stored edits.
 */
export const getSteps = query({
  args: { id: v.string(), version: v.number() },
  returns: v.object({
    steps: v.array(v.string()),
    clientIds: v.array(clientId),
    version: v.number(),
  }),
  handler: async (ctx, args) => {
    const document = await requireDocument(ctx, args.id);
    assertVersion(args.version);
    return ctx.runQuery(components.prosemirrorSync.lib.getSteps, {
      ...args,
      id: document._id,
    });
  },
});
/**
 * Accept incremental edits through the validated sync adapter. Current-version
 * submissions are checked against the document schema; stale submissions receive
 * needs-rebase plus missing steps so the client can transform and retry.
 */
export const submitSteps = mutation({
  args: {
    id: v.string(),
    version: v.number(),
    clientId,
    steps: v.array(v.string()),
    protocol: v.optional(v.number()),
    credential: v.optional(
      v.object({ session: v.id("documentAuthorSessions"), secret: v.string() }),
    ),
  },
  returns: v.union(
    v.object({ status: v.literal("synced") }),
    v.object({
      status: v.literal("needs-rebase"),
      steps: v.array(v.string()),
      clientIds: v.array(clientId),
    }),
  ),
  handler: submitDocumentSteps,
});
/**
 * Store a loading optimization for already accepted edits. The adapter reconstructs
 * canonical content at the supplied version and rejects mismatches; this endpoint
 * cannot replace the document with arbitrary client-provided content.
 */
export const submitSnapshot = mutation({
  args: { id: v.string(), version: v.number(), content: v.string() },
  returns: v.null(),
  handler: submitDocumentSnapshot,
});

/** Enable attribution and establish a stable author with a fresh editor session. */
export const openAuthorship = mutation({
  args: {
    id: v.string(),
    guest: v.optional(
      v.object({ author: v.id("documentAuthors"), secret: v.string() }),
    ),
  },
  returns: v.object({
    paragraphs: v.optional(v.boolean()),
    author: v.id("documentAuthors"),
    credential: v.object({
      session: v.id("documentAuthorSessions"),
      secret: v.string(),
    }),
    guest: v.union(
      v.null(),
      v.object({ author: v.id("documentAuthors"), secret: v.string() }),
    ),
  }),
  handler: openAuthor,
});
export const authors = query({
  args: { id: v.string(), authors: v.array(v.id("documentAuthors")) },
  returns: v.array(
    v.object({
      id: v.id("documentAuthors"),
      label: v.string(),
      kind: v.union(
        v.literal("guest"),
        v.literal("user"),
        v.literal("agent"),
        v.literal("unknown"),
      ),
    }),
  ),
  handler: authorProfiles,
});

const descriptor = v.object({
  documentId: v.id("documents"),
  canvasId: v.string(),
  generation: v.number(),
  role: v.union(v.literal("main"), v.literal("reply"), v.literal("card")),
  paragraphs: v.boolean(),
});
export const describe = query({
  args: { documentId: v.id("documents") },
  returns: descriptor,
  handler: (ctx, args) => describeDocument(ctx, args.documentId),
});
export const paragraphs = query({
  args: { documentId: v.id("documents") },
  returns: descriptor.omit("paragraphs").extend({
    version: v.number(),
    paragraphs: v.array(
      v.object({
        paragraphId: v.string(),
        text: v.string(),
        from: v.number(),
        to: v.number(),
      }),
    ),
  }),
  handler: (ctx, args) => readParagraphs(ctx, args.documentId),
});
export const linkParagraph = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    elementId: v.union(v.id("canvasDocuments"), v.id("sources")),
    documentId: v.id("documents"),
    paragraphId: v.string(),
    version: v.number(),
  },
  returns: v.null(),
  handler: linkParagraphHandler,
});
export const links = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(
    v.object({
      elementId: v.union(v.id("canvasDocuments"), v.id("sources")),
      documentId: v.id("documents"),
      paragraphId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("documentLinks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(202);
    return rows.flatMap(({ elementId, documentId, paragraphId }) => {
      const active =
        ctx.db.normalizeId("canvasDocuments", elementId) ??
        ctx.db.normalizeId("sources", elementId);
      return active
        ? [
            {
              elementId: active,
              documentId,
              paragraphId,
            },
          ]
        : [];
    });
  },
});
export const resolveParagraph = query({
  args: { documentId: v.id("documents"), paragraphId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      version: v.number(),
      generation: v.number(),
      from: v.number(),
      to: v.number(),
      text: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const document = await requireDocument(ctx, args.documentId),
      child = document.element ? await ctx.db.get(document.element) : null;
    if (!child || child.removed) return null;
    const current = await readParagraphs(ctx, args.documentId),
      paragraph = current.paragraphs.find(
        (p) => p.paragraphId === args.paragraphId,
      );
    return paragraph
      ? {
          version: current.version,
          generation: current.generation,
          from: paragraph.from,
          to: paragraph.to,
          text: paragraph.text,
        }
      : null;
  },
});
