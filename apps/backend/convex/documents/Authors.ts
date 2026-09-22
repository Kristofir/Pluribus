import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireDocument } from "./Access";
export type Credential = {
  session: Id<"documentAuthorSessions">;
  secret: string;
};
export async function hashSecret(secret: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
/** Guest credentials establish continuity, not a verified human identity. */
export async function openAuthorship(
  ctx: MutationCtx,
  args: {
    id: string;
    guest?: { author: Id<"documentAuthors">; secret: string };
  },
) {
  const document = await requireDocument(ctx, args.id, true);
  const user = await getAuthUserId(ctx);
  let author: Id<"documentAuthors">;
  let guest: { author: Id<"documentAuthors">; secret: string } | undefined;
  if (user) {
    const existing = await ctx.db
      .query("documentAuthors")
      .withIndex("by_user", (q) => q.eq("userId", user))
      .unique();
    author =
      existing?._id ??
      (await ctx.db.insert("documentAuthors", {
        kind: "user",
        userId: user,
        label: `Member ${user.slice(-4)}`,
      }));
  } else if (args.guest) {
    const row = await ctx.db.get(args.guest.author);
    if (
      !row ||
      row.kind !== "guest" ||
      row.secretHash !== (await hashSecret(args.guest.secret))
    )
      throw new Error("Invalid guest author credential");
    author = row._id;
    guest = args.guest;
  } else {
    const secret = crypto.randomUUID();
    author = await ctx.db.insert("documentAuthors", {
      kind: "guest",
      secretHash: await hashSecret(secret),
      label: `Guest ${crypto.randomUUID().slice(0, 4)}`,
    });
    guest = { author, secret };
  }
  const secret = crypto.randomUUID();
  const session = await ctx.db.insert("documentAuthorSessions", {
    author,
    scope: args.id,
    secretHash: await hashSecret(secret),
  });
  await ctx.db.patch(document._id, { authorship: 1 });
  return {
    author,
    credential: { session, secret },
    guest: guest ?? null,
    paragraphs: !!document.paragraphs,
  };
}
export async function requireAuthor(
  ctx: MutationCtx,
  scope: string,
  credential?: Credential,
) {
  if (!credential) throw new Error("Reload this document to use authorship");
  const session = await ctx.db.get(credential.session);
  if (
    !session ||
    session.scope !== scope ||
    session.secretHash !== (await hashSecret(credential.secret))
  )
    throw new Error("Invalid author session");
  const author = await ctx.db.get(session.author);
  if (
    !author ||
    author.kind === "agent" ||
    (author.kind === "user" && (await getAuthUserId(ctx)) !== author.userId)
  )
    throw new Error("Author identity changed");
  return { author: author._id, session: session._id };
}
/** Resolve a bounded set of public author labels for the document UI. */
export async function authorProfiles(
  ctx: QueryCtx,
  args: { id: string; authors: Id<"documentAuthors">[] },
) {
  const document = await requireDocument(ctx, args.id);
  if (args.authors.length > 256)
    throw new Error("Too many authors in one request");
  return Promise.all(
    [...new Set(args.authors)].map(async (id) => {
      const session = await ctx.db
        .query("documentAuthorSessions")
        .withIndex("by_scope_author", (q) =>
          q.eq("scope", args.id).eq("author", id),
        )
        .first();
      const accepted = session
        ? true
        : await ctx.db
            .query("documentOperations")
            .withIndex("by_document_author", (q) =>
              q.eq("document", document._id).eq("author", id),
            )
            .first();
      const row = accepted ? await ctx.db.get(id) : null;
      return {
        id,
        label: row?.label ?? "Unknown",
        kind: row?.kind ?? ("unknown" as const),
      };
    }),
  );
}
