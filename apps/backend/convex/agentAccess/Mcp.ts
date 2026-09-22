import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { AgentParagraphEdit } from "@pluribus/core/documents/agentEdits";
const object = (x: unknown): Record<string, unknown> => {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new Error("Expected object");
  return x as Record<string, unknown>;
};
const string = (x: unknown) => {
  if (typeof x !== "string") throw new Error("Expected string");
  return x;
};
const number = (x: unknown) => {
  if (typeof x !== "number" || !Number.isSafeInteger(x) || x < 1)
    throw new Error("Expected version");
  return x;
};
const finite = (x: unknown) => {
  if (typeof x !== "number" || !Number.isFinite(x))
    throw new Error("Expected number");
  return x;
};
const cardGeometry = (value: unknown) => {
  const g = object(value);
  return {
    x: finite(g.x),
    y: finite(g.y),
    width: finite(g.width),
    height: finite(g.height),
  };
};
function edits(value: unknown): AgentParagraphEdit[] {
  if (!Array.isArray(value)) throw new Error("Expected edits");
  return value.map((raw) => {
    const e = object(raw);
    switch (e.kind) {
      case "replace":
        return {
          kind: "replace",
          paragraphId: string(e.paragraphId),
          text: string(e.text),
        };
      case "delete":
        return { kind: "delete", paragraphId: string(e.paragraphId) };
      case "insert":
        return {
          kind: "insert",
          afterParagraphId:
            e.afterParagraphId === null ? null : string(e.afterParagraphId),
          text: string(e.text),
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
const tools = [
  {
    name: "read_canvas",
    description:
      "Read active document, Web Page and Image cards in the granted workspace. Read document text with read_document.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "read_web_page",
    description:
      "Read the full saved content of an active Web Page card in the granted canvas.",
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
      "Read a granted document's canonical paragraphs, version and editing generation.",
    inputSchema: {
      type: "object",
      properties: { documentId: textField },
      required: ["documentId"],
      additionalProperties: false,
    },
  },
  {
    name: "read_context",
    description:
      "Read the selected, versioned context snapshot prepared by the user.",
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
      "Apply up to 20 paragraph insert/replace/delete commands at an EXACT baseVersion. On conflict reread and regenerate intentionally. Reuse requestId only for the exact same request after a lost response.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: textField,
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
      "Create a document card or enqueue a Web Page capture in this workspace. Returns an Element History action; reread the canvas for the new card and document ID. Web Page capture finishes asynchronously.",
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
      "Move or resize one active document, Web Page or Image card. Supply its generation and expectedGeometry from read_canvas; a later move or lifecycle change is refused.",
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
      "Remove one active document, Web Page or Image card from this workspace. Use its current generation from read_canvas; the action can be reversed conditionally.",
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
      "Conditionally undo or redo this agent's create, geometry or delete action. Use its action ID and latest revision; later conflicting card changes prevent reversal.",
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
];
/** Stateless Streamable HTTP (2025-06-18); bearer grants are separate from Google browser sessions. */
export const mcp = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin");
  if (origin && origin !== process.env.SITE_URL)
    return new Response("Origin denied", { status: 403 });
  if (request.method === "GET")
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer "))
    return new Response("Bearer grant required", { status: 401 });
  const token = header.slice(7);
  try {
    await ctx.runQuery(internal.agentAccess.Tools.authenticate, { token });
  } catch {
    return new Response("Agent access denied", { status: 401 });
  }
  const protocol = request.headers.get("MCP-Protocol-Version");
  if (protocol && !["2025-03-26", "2025-06-18"].includes(protocol))
    return new Response("Unsupported protocol version", { status: 400 });
  if (!request.headers.get("Content-Type")?.includes("application/json"))
    return new Response("JSON required", { status: 415 });
  const raw = await request.text();
  if (raw.length > 100000)
    return new Response("Request too large", { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = object(JSON.parse(raw));
  } catch {
    return new Response("Invalid JSON-RPC", { status: 400 });
  }
  if (body.jsonrpc !== "2.0" || typeof body.method !== "string")
    return new Response("Invalid JSON-RPC", { status: 400 });
  try {
    await ctx.runMutation(internal.agentAccess.Tools.touchPresence, { token });
  } catch {
    return new Response("Agent access denied", { status: 401 });
  }
  if (body.id === undefined) return new Response(null, { status: 202 });
  if (typeof body.id !== "string" && typeof body.id !== "number")
    return new Response("Invalid request ID", { status: 400 });
  const reply = (result: unknown) =>
    Response.json({ jsonrpc: "2.0", id: body.id, result });
  if (body.method === "initialize")
    return reply({
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "Pluribus documents", version: "1" },
    });
  if (body.method === "ping") return reply({});
  if (body.method === "tools/list") return reply({ tools });
  if (body.method !== "tools/call")
    return Response.json({
      jsonrpc: "2.0",
      id: body.id,
      error: { code: -32601, message: "Method not found" },
    });
  try {
    const params = object(body.params),
      args = object(params.arguments ?? {});
    let result: unknown;
    if (params.name === "read_canvas")
      result = await ctx.runQuery(internal.agentAccess.Tools.readCanvas, {
        token,
      });
    else if (params.name === "read_web_page")
      result = await ctx.runQuery(internal.agentAccess.Tools.readWebPage, {
        token,
        sourceId: string(args.sourceId) as Id<"sources">,
      });
    else if (params.name === "read_document")
      result = await ctx.runQuery(internal.agentAccess.Tools.readDocument, {
        token,
        documentId: string(args.documentId) as Id<"documents">,
      });
    else if (params.name === "read_context")
      result = JSON.parse(
        await ctx.runQuery(internal.agentAccess.Tools.context, {
          token,
          contextSnapshotId: string(
            args.contextSnapshotId,
          ) as Id<"agentContexts">,
        }),
      );
    else if (params.name === "edit_document")
      result = await ctx.runMutation(internal.agentAccess.Tools.applyEdit, {
        token,
        documentId: string(args.documentId) as Id<"documents">,
        requestId: string(args.requestId),
        generation: number(args.generation),
        baseVersion: number(args.baseVersion),
        edits: edits(args.edits),
        ...(args.contextSnapshotId !== undefined
          ? {
              contextSnapshotId: string(
                args.contextSnapshotId,
              ) as Id<"agentContexts">,
            }
          : {}),
      });
    else if (params.name === "create_card") {
      const card = object(args.card);
      const geometry = cardGeometry(card.geometry);
      if (card.kind === "document")
        result = await ctx.runMutation(internal.agentAccess.Tools.createCard, {
          token,
          requestId: string(args.requestId),
          card: { kind: "document", geometry },
        });
      else if (card.kind === "web_page")
        result = await ctx.runMutation(internal.agentAccess.Tools.createCard, {
          token,
          requestId: string(args.requestId),
          card: {
            kind: "web_page",
            geometry,
            url: string(card.url),
            ...(card.prompt === undefined
              ? {}
              : { prompt: string(card.prompt) }),
          },
        });
      else throw new Error("Unknown card kind");
    } else if (params.name === "set_card_geometry")
      result = await ctx.runMutation(
        internal.agentAccess.Tools.setCardGeometry,
        {
          token,
          requestId: string(args.requestId),
          id: string(args.id) as Id<"canvasDocuments">,
          generation: number(args.generation),
          expectedGeometry: cardGeometry(args.expectedGeometry),
          geometry: cardGeometry(args.geometry),
        },
      );
    else if (params.name === "delete_card")
      result = await ctx.runMutation(internal.agentAccess.Tools.deleteCard, {
        token,
        requestId: string(args.requestId),
        id: string(args.id) as Id<"canvasDocuments">,
        generation: number(args.generation),
      });
    else if (params.name === "reverse_card_action") {
      if (typeof args.undo !== "boolean") throw new Error("Expected boolean");
      result = await ctx.runMutation(
        internal.agentAccess.Tools.reverseCardAction,
        {
          token,
          actionId: string(args.actionId),
          requestId: string(args.requestId),
          revision: number(args.revision),
          undo: args.undo,
        },
      );
    } else throw new Error("Unknown tool");
    return reply({ content: [{ type: "text", text: JSON.stringify(result) }] });
  } catch {
    return reply({
      isError: true,
      content: [
        {
          type: "text",
          text: "Request rejected. Check grant scope, card or paragraph IDs, current generation or version, geometry, and request identity. Reread the canvas or document before retrying a changed command with a new request ID.",
        },
      ],
    });
  }
});
