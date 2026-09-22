import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { AgentParagraphEdit } from "@pluribus/core/documents/agentEdits";

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected object");
  return value as Record<string, unknown>;
};
const string = (value: unknown) => {
  if (typeof value !== "string") throw new Error("Expected string");
  return value;
};
const positiveInteger = (value: unknown) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new Error("Expected positive integer");
  return value;
};
const finite = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("Expected number");
  return value;
};
const cardGeometry = (value: unknown) => {
  const geometry = object(value);
  return {
    x: finite(geometry.x),
    y: finite(geometry.y),
    width: finite(geometry.width),
    height: finite(geometry.height),
  };
};
function paragraphEdits(value: unknown): AgentParagraphEdit[] {
  if (!Array.isArray(value)) throw new Error("Expected edits");
  return value.map((raw) => {
    const edit = object(raw);
    switch (edit.kind) {
      case "replace":
        return {
          kind: "replace",
          paragraphId: string(edit.paragraphId),
          text: string(edit.text),
        };
      case "delete":
        return { kind: "delete", paragraphId: string(edit.paragraphId) };
      case "insert":
        return {
          kind: "insert",
          afterParagraphId:
            edit.afterParagraphId === null
              ? null
              : string(edit.afterParagraphId),
          text: string(edit.text),
        };
      default:
        throw new Error("Unknown edit");
    }
  });
}

const textField = { type: "string" };
const requestField = {
  type: "string",
  description: "UUID. Reuse only for an exact retry of the same command.",
};
const geometryField = {
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    width: { type: "number" },
    height: { type: "number" },
  },
  required: ["x", "y", "width", "height"],
  additionalProperties: false,
};

export const agentTools = [
  {
    name: "read_canvas",
    description:
      "Read active Note, Web and Image cards in the workspace, including saved AI image descriptions when available. Read Note text with read_document.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "read_web_page",
    description: "Read the saved content of an active Web card.",
    inputSchema: {
      type: "object",
      properties: { sourceId: textField },
      required: ["sourceId"],
      additionalProperties: false,
    },
  },
  {
    name: "read_document",
    description:
      "Read a Note's canonical paragraphs, version and editing generation.",
    inputSchema: {
      type: "object",
      properties: { documentId: textField },
      required: ["documentId"],
      additionalProperties: false,
    },
  },
  {
    name: "read_context",
    description: "Read a context snapshot explicitly prepared by the user.",
    inputSchema: {
      type: "object",
      properties: { contextSnapshotId: textField },
      required: ["contextSnapshotId"],
      additionalProperties: false,
    },
  },
  {
    name: "edit_document",
    description:
      "Apply up to 20 paragraph edits at an exact baseVersion. Reread after a conflict and use a new requestId for a changed command.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: requestField,
        documentId: textField,
        generation: { type: "integer", minimum: 1 },
        baseVersion: { type: "integer", minimum: 1 },
        contextSnapshotId: textField,
        edits: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: {
            oneOf: [
              {
                type: "object",
                properties: {
                  kind: { const: "replace" },
                  paragraphId: textField,
                  text: textField,
                },
                required: ["kind", "paragraphId", "text"],
                additionalProperties: false,
              },
              {
                type: "object",
                properties: {
                  kind: { const: "delete" },
                  paragraphId: textField,
                },
                required: ["kind", "paragraphId"],
                additionalProperties: false,
              },
              {
                type: "object",
                properties: {
                  kind: { const: "insert" },
                  afterParagraphId: { type: ["string", "null"] },
                  text: textField,
                },
                required: ["kind", "afterParagraphId", "text"],
                additionalProperties: false,
              },
            ],
          },
        },
      },
      required: [
        "requestId",
        "documentId",
        "generation",
        "baseVersion",
        "edits",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "create_card",
    description:
      "Create a Note or enqueue a Web capture. Web capture completes asynchronously. Read the canvas afterward for the created card ID.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: requestField,
        card: {
          oneOf: [
            {
              type: "object",
              properties: {
                kind: { const: "document" },
                geometry: geometryField,
              },
              required: ["kind", "geometry"],
              additionalProperties: false,
            },
            {
              type: "object",
              properties: {
                kind: { const: "web_page" },
                geometry: geometryField,
                url: textField,
                prompt: textField,
              },
              required: ["kind", "geometry", "url"],
              additionalProperties: false,
            },
          ],
        },
      },
      required: ["requestId", "card"],
      additionalProperties: false,
    },
  },
  {
    name: "set_card_geometry",
    description:
      "Move or resize one active card. Supply its current generation and expectedGeometry from read_canvas.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: requestField,
        id: textField,
        generation: { type: "integer", minimum: 1 },
        expectedGeometry: geometryField,
        geometry: geometryField,
      },
      required: [
        "requestId",
        "id",
        "generation",
        "expectedGeometry",
        "geometry",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "delete_card",
    description:
      "Remove one active card using its current generation from read_canvas.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: requestField,
        id: textField,
        generation: { type: "integer", minimum: 1 },
      },
      required: ["requestId", "id", "generation"],
      additionalProperties: false,
    },
  },
  {
    name: "reverse_card_action",
    description:
      "Conditionally undo or redo this agent's create, geometry or delete action.",
    inputSchema: {
      type: "object",
      properties: {
        actionId: requestField,
        requestId: requestField,
        revision: { type: "integer", minimum: 1 },
        undo: { type: "boolean" },
      },
      required: ["actionId", "requestId", "revision", "undo"],
      additionalProperties: false,
    },
  },
] as const;

type ToolContext = Pick<ActionCtx, "runQuery" | "runMutation">;

export async function callAgentTool(
  ctx: ToolContext,
  token: string,
  name: string,
  rawArguments: unknown,
): Promise<unknown> {
  const args = object(rawArguments ?? {});
  if (name === "read_canvas")
    return ctx.runQuery(internal.agentAccess.Tools.readCanvas, { token });
  if (name === "read_web_page")
    return ctx.runQuery(internal.agentAccess.Tools.readWebPage, {
      token,
      sourceId: string(args.sourceId) as Id<"sources">,
    });
  if (name === "read_document")
    return ctx.runQuery(internal.agentAccess.Tools.readDocument, {
      token,
      documentId: string(args.documentId) as Id<"documents">,
    });
  if (name === "read_context")
    return JSON.parse(
      await ctx.runQuery(internal.agentAccess.Tools.context, {
        token,
        contextSnapshotId: string(
          args.contextSnapshotId,
        ) as Id<"agentContexts">,
      }),
    );
  if (name === "edit_document")
    return ctx.runMutation(internal.agentAccess.Tools.applyEdit, {
      token,
      documentId: string(args.documentId) as Id<"documents">,
      requestId: string(args.requestId),
      generation: positiveInteger(args.generation),
      baseVersion: positiveInteger(args.baseVersion),
      edits: paragraphEdits(args.edits),
      ...(args.contextSnapshotId === undefined
        ? {}
        : {
            contextSnapshotId: string(
              args.contextSnapshotId,
            ) as Id<"agentContexts">,
          }),
    });
  if (name === "create_card") {
    const card = object(args.card);
    const geometry = cardGeometry(card.geometry);
    if (card.kind === "document")
      return ctx.runMutation(internal.agentAccess.Tools.createCard, {
        token,
        requestId: string(args.requestId),
        card: { kind: "document", geometry },
      });
    if (card.kind === "web_page")
      return ctx.runMutation(internal.agentAccess.Tools.createCard, {
        token,
        requestId: string(args.requestId),
        card: {
          kind: "web_page",
          geometry,
          url: string(card.url),
          ...(card.prompt === undefined ? {} : { prompt: string(card.prompt) }),
        },
      });
    throw new Error("Unknown card kind");
  }
  if (name === "set_card_geometry")
    return ctx.runMutation(internal.agentAccess.Tools.setCardGeometry, {
      token,
      requestId: string(args.requestId),
      id: string(args.id) as Id<"canvasDocuments">,
      generation: positiveInteger(args.generation),
      expectedGeometry: cardGeometry(args.expectedGeometry),
      geometry: cardGeometry(args.geometry),
    });
  if (name === "delete_card")
    return ctx.runMutation(internal.agentAccess.Tools.deleteCard, {
      token,
      requestId: string(args.requestId),
      id: string(args.id) as Id<"canvasDocuments">,
      generation: positiveInteger(args.generation),
    });
  if (name === "reverse_card_action") {
    if (typeof args.undo !== "boolean") throw new Error("Expected boolean");
    return ctx.runMutation(internal.agentAccess.Tools.reverseCardAction, {
      token,
      actionId: string(args.actionId),
      requestId: string(args.requestId),
      revision: positiveInteger(args.revision),
      undo: args.undo,
    });
  }
  throw new Error("Unknown tool");
}
