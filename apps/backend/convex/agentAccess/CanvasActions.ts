import { v, type Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { hashSecret } from "../documents/Authors";
import { geometry } from "../canvas/Model";
import { historyPorts, storedOutcome } from "../canvas/HistoryPersistence";
import { toElementId } from "../canvas/ElementLifecycles";
import { requireGrant } from "./Access";
import { executeHistoryAttempt } from "@pluribus/core/canvas/history/operations";
import { sameGeometry } from "@pluribus/core/canvas/geometryHistory";
import {
  sealGesture,
  updateGesture,
} from "@pluribus/core/canvas/history/geometry";

export const cardId = v.union(
  v.id("canvasDocuments"),
  v.id("sources"),
  v.id("canvasImages"),
);
export const cardInput = v.union(
  v.object({ kind: v.literal("document"), geometry }),
  v.object({
    kind: v.literal("web_page"),
    geometry,
    url: v.string(),
    prompt: v.optional(v.string()),
  }),
);

function requestIdentity(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error("Use a UUID request ID");
}

async function agentHistory(ctx: MutationCtx, token: string) {
  const grant = await requireGrant(ctx, token);
  if (!grant.workspaceScope) throw new Error("Workspace grant required");
  const nonce = `agent:${grant._id}`;
  let session = await ctx.db
    .query("canvasHistorySessions")
    .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
    .unique();
  if (!session) {
    const id = await ctx.db.insert("canvasHistorySessions", {
      nonce,
      scope: String(grant.workspaceId),
      owner: grant.userId,
      proof: await hashSecret(crypto.randomUUID()),
      version: 2,
    });
    session = await ctx.db.get(id);
  }
  if (!session || session.scope !== String(grant.workspaceId))
    throw new Error("Agent History unavailable");
  return {
    grant,
    ports: historyPorts(
      ctx,
      session._id,
      { kind: "authenticated" },
      String(grant.workspaceId),
      grant.userId,
    ),
  };
}

const fingerprint = (value: unknown) => hashSecret(JSON.stringify(value));

export async function createAgentCard(
  ctx: MutationCtx,
  args: { token: string; requestId: string; card: Infer<typeof cardInput> },
) {
  requestIdentity(args.requestId);
  const { grant, ports } = await agentHistory(ctx, args.token);
  const element =
    args.card.kind === "document"
      ? args.card
      : {
          kind: "source" as const,
          geometry: args.card.geometry,
          url: args.card.url,
          prompt: args.card.prompt,
        };
  const command = {
    kind: "apply" as const,
    input: { kind: "create" as const, element },
  };
  const result = await executeHistoryAttempt(ports, {
    action: args.requestId,
    attempt: args.requestId,
    fingerprint: await fingerprint(command),
    deletion: `agent:${grant._id}:${args.requestId}`,
    command,
  });
  return storedOutcome(ctx, result);
}

export async function setAgentCardGeometry(
  ctx: MutationCtx,
  args: {
    token: string;
    requestId: string;
    id: Infer<typeof cardId>;
    generation: number;
    expectedGeometry: Infer<typeof geometry>;
    geometry: Infer<typeof geometry>;
  },
) {
  requestIdentity(args.requestId);
  const { ports } = await agentHistory(ctx, args.token);
  const update = {
    id: toElementId(args.id),
    generation: args.generation,
    geometry: args.geometry,
  };
  const digest = await fingerprint({
    kind: "geometry",
    update,
    expectedGeometry: args.expectedGeometry,
  });
  const prior = await ports.attempts.get(args.requestId);
  if (prior)
    return storedOutcome(
      ctx,
      prior.fingerprint === digest
        ? prior.outcome
        : {
            status: "rejected",
            action: args.requestId,
            revision: 0,
            id: null,
            sequence: 0,
            message: "Request identity was reused.",
          },
    );
  const current = await ports.elements.get(update.id);
  if (
    !current ||
    current.removed ||
    current.generation !== args.generation ||
    !sameGeometry(current.geometry, args.expectedGeometry)
  ) {
    const result = {
      status: "obsolete" as const,
      action: args.requestId,
      revision: 0,
      id: null,
      sequence: 0,
      message: "Card geometry changed; read_canvas before retrying.",
    };
    await ports.attempts.save(args.requestId, digest, result);
    return storedOutcome(ctx, result);
  }
  const ack = await updateGesture(ports, args.requestId, 1, digest, [update]);
  if (ack.status !== "accepted") {
    const result = {
      status: "obsolete" as const,
      action: args.requestId,
      revision: 0,
      id: null,
      sequence: ack.sequence,
      message: "Card changed; read_canvas before retrying.",
    };
    await ports.attempts.save(args.requestId, digest, result);
    return storedOutcome(ctx, result);
  }
  const record = await ports.actions.get(args.requestId);
  if (!record) throw new Error("Geometry action unavailable");
  const result = {
    ...(await sealGesture(ports, record)),
    id: toElementId(args.id),
  };
  await ports.attempts.save(args.requestId, digest, result);
  return storedOutcome(ctx, result);
}

export async function deleteAgentCard(
  ctx: MutationCtx,
  args: {
    token: string;
    requestId: string;
    id: Infer<typeof cardId>;
    generation: number;
  },
) {
  requestIdentity(args.requestId);
  const { grant, ports } = await agentHistory(ctx, args.token);
  const command = {
    kind: "apply" as const,
    input: {
      kind: "delete" as const,
      id: toElementId(args.id),
      generation: args.generation,
    },
  };
  const result = await executeHistoryAttempt(ports, {
    action: args.requestId,
    attempt: args.requestId,
    fingerprint: await fingerprint(command),
    deletion: `agent:${grant._id}:${args.requestId}`,
    command,
  });
  return storedOutcome(ctx, result);
}

export async function reverseAgentCardAction(
  ctx: MutationCtx,
  args: {
    token: string;
    actionId: string;
    requestId: string;
    revision: number;
    undo: boolean;
  },
) {
  requestIdentity(args.actionId);
  requestIdentity(args.requestId);
  const { grant, ports } = await agentHistory(ctx, args.token);
  const command = {
    kind: "reverse" as const,
    undo: args.undo,
    revision: args.revision,
  };
  const result = await executeHistoryAttempt(ports, {
    action: args.actionId,
    attempt: args.requestId,
    fingerprint: await fingerprint({ actionId: args.actionId, command }),
    deletion: `agent:${grant._id}:${args.requestId}`,
    command,
  });
  return storedOutcome(ctx, result);
}
