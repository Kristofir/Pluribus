import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { agentTools, callAgentTool } from "./ToolProtocol";

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected object");
  return value as Record<string, unknown>;
};

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
  if (body.method === "tools/list") return reply({ tools: agentTools });
  if (body.method !== "tools/call")
    return Response.json({
      jsonrpc: "2.0",
      id: body.id,
      error: { code: -32601, message: "Method not found" },
    });
  try {
    const params = body.params;
    if (!params || typeof params !== "object" || Array.isArray(params))
      throw new Error("Expected params");
    const values = params as Record<string, unknown>;
    const result = await callAgentTool(
      ctx,
      token,
      typeof values.name === "string" ? values.name : "",
      values.arguments ?? {},
    );
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
