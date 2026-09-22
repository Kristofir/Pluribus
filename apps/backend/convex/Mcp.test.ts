/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");

test("MCP HTTP client initializes, reads, edits, retries and loses access after revocation", async () => {
  const t = convexTest(schema, modules);
  register(t);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const workspaceId = await t.mutation(
    internal.workspaces.Provisioning.provision,
    { slug: "http-smoke", name: "HTTP smoke", assignments: [] },
  );
  await t.run((ctx) =>
    ctx.db.insert("workspaceMembers", { workspaceId, userId }),
  );
  const user = t.withIdentity({ subject: userId });
  const { mainDocumentId } = await user.query(api.Workspaces.open, {
    workspaceId,
  });
  const grant = await user.mutation(api.AgentAccess.grant, {
    workspaceId,
    documentIds: [mainDocumentId],
    label: "HTTP fixture",
  });
  let sequence = 0;
  const request = (method: string, params: unknown = {}) =>
    t.fetch("/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${grant.token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-06-18",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++sequence, method, params }),
    });
  const call = async (name: string, args: unknown) => {
    const response = await request("tools/call", { name, arguments: args });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.isError).not.toBe(true);
    return JSON.parse(body.result.content[0].text);
  };
  expect((await t.fetch("/mcp", { method: "GET" })).status).toBe(405);
  expect((await t.fetch("/mcp", { method: "POST" })).status).toBe(401);
  expect(
    (
      await t.fetch("/mcp", {
        method: "POST",
        headers: { Origin: "https://untrusted.invalid" },
      })
    ).status,
  ).toBe(403);
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "Test client", version: "1" },
  });
  expect((await init.json()).result.protocolVersion).toBe("2025-06-18");
  expect(
    (await (await request("tools/list")).json()).result.tools,
  ).toHaveLength(3);
  const doc = await call("read_document", { documentId: mainDocumentId });
  const edit = {
    documentId: mainDocumentId,
    generation: doc.generation,
    baseVersion: doc.version,
    requestId: crypto.randomUUID(),
    edits: [
      {
        kind: "replace",
        paragraphId: doc.paragraphs[0].paragraphId,
        text: "HTTP authored text",
      },
    ],
  };
  const accepted = await call("edit_document", edit);
  expect(accepted.status).toBe("applied");
  expect(await call("edit_document", edit)).toEqual(accepted);
  expect(
    (await call("read_document", { documentId: mainDocumentId })).paragraphs[0]
      .text,
  ).toBe("HTTP authored text");
  await user.mutation(api.AgentAccess.revoke, { grantId: grant.grantId });
  expect((await request("tools/list")).status).toBe(401);
});
