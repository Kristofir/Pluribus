/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { expect, test, vi, afterEach } from "vitest";
import schema from "./schema";
import { hashSecret } from "./documents/Authors";
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
  const cardId = await user.mutation(api.Canvas.createDocument, {
    workspaceId,
    geometry: { x: 12, y: 34, width: 430, height: 500 },
  });
  const legacyCardId = await user.mutation(api.Canvas.createDocument, {
    workspaceId,
    geometry: { x: 500, y: 34, width: 430, height: 500 },
  });
  const legacyDocumentId = await t.run(
    async (ctx) => (await ctx.db.get(legacyCardId))!.documentId!,
  );
  const sourceId = await t.run((ctx) =>
    ctx.db.insert("sources", {
      workspaceId,
      userId,
      url: "https://example.test/page",
      status: "ready",
      revision: 1,
      capture: {
        id: "capture-1",
        capturedAt: 123,
        content: "Full saved page content",
        title: "Example page",
      },
    }),
  );
  const grant = await user.mutation(api.AgentAccess.grant, {
    workspaceId,
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
    await user.query(api.Presence.agents, {
      context: { kind: "canvas", id: workspaceId },
    }),
  ).toEqual([{ id: grant.grantId, label: "HTTP fixture" }]);
  expect(
    await user.query(api.Presence.agents, {
      context: { kind: "document", id: legacyDocumentId },
    }),
  ).toEqual([{ id: grant.grantId, label: "HTTP fixture" }]);
  expect(
    (await (await request("tools/list")).json()).result.tools,
  ).toHaveLength(9);
  const canvas = await call("read_canvas", {});
  expect(canvas).not.toHaveProperty("mainDocumentId");
  expect(canvas.elements).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "main_document" }),
    ]),
  );
  expect(canvas.elements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "document",
        id: cardId,
        canReadContent: true,
      }),
      expect.objectContaining({
        kind: "web_page",
        id: sourceId,
        title: "Example page",
      }),
    ]),
  );
  expect((await call("read_web_page", { sourceId })).capture.content).toBe(
    "Full saved page content",
  );
  const cardDocumentId = canvas.elements.find(
    (element: { id?: string }) => element.id === cardId,
  ).documentId;
  expect(
    (await call("read_document", { documentId: cardDocumentId })).documentId,
  ).toBe(cardDocumentId);
  const otherWorkspaceId = await t.mutation(
    internal.workspaces.Provisioning.provision,
    { slug: "http-other", name: "Other", assignments: [] },
  );
  const otherSourceId = await t.run((ctx) =>
    ctx.db.insert("sources", {
      workspaceId: otherWorkspaceId,
      userId,
      url: "https://example.test/private",
      status: "ready",
      revision: 1,
      capture: { id: "private", capturedAt: 123, content: "Other workspace" },
    }),
  );
  expect(
    (
      await (
        await request("tools/call", {
          name: "read_web_page",
          arguments: { sourceId: otherSourceId },
        })
      ).json()
    ).result.isError,
  ).toBe(true);
  await t.run((ctx) => ctx.db.patch(sourceId, { removed: true }));
  expect((await call("read_canvas", {})).elements).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ id: sourceId })]),
  );
  expect(
    (
      await (
        await request("tools/call", {
          name: "read_web_page",
          arguments: { sourceId },
        })
      ).json()
    ).result.isError,
  ).toBe(true);
  const legacyToken = crypto.randomUUID() + crypto.randomUUID();
  const oldGrant = { token: legacyToken };
  await t.run(async (ctx) =>
    ctx.db.insert("agentGrants", {
      workspaceId,
      userId,
      documentIds: [legacyDocumentId],
      canvasRead: false,
      label: "Document only",
      tokenHash: await hashSecret(legacyToken),
      revoked: false,
    }),
  );
  expect(
    (
      await t.query(internal.agentAccess.Tools.readDocument, {
        token: oldGrant.token,
        documentId: legacyDocumentId,
      })
    ).documentId,
  ).toBe(legacyDocumentId);
  await expect(
    t.query(internal.agentAccess.Tools.readDocument, {
      token: oldGrant.token,
      documentId: cardDocumentId,
    }),
  ).rejects.toThrow("Agent access denied");
  expect(
    (
      await (
        await t.fetch("/mcp", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${oldGrant.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 999,
            method: "tools/call",
            params: { name: "read_canvas", arguments: {} },
          }),
        })
      ).json()
    ).result.isError,
  ).toBe(true);
  const doc = await call("read_document", { documentId: legacyDocumentId });
  const edit = {
    documentId: legacyDocumentId,
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
    (await call("read_document", { documentId: legacyDocumentId }))
      .paragraphs[0].text,
  ).toBe("HTTP authored text");
  const agentChange = await t.run((ctx) =>
    ctx.db.get("agentChanges", accepted.operationGroupId),
  );
  const grantRow = await t.run((ctx) => ctx.db.get(grant.grantId));
  expect(agentChange?.author).toBe(grantRow?.authorId);
  await user.mutation(api.AgentAccess.revoke, { grantId: grant.grantId });
  expect(
    (
      await user.query(api.Presence.agents, {
        context: { kind: "canvas", id: workspaceId },
      })
    ).some((agent) => agent.id === grant.grantId),
  ).toBe(false);
  expect((await request("tools/list")).status).toBe(401);
});

test("MCP card actions create, move, delete and reverse with grant-bound History", async () => {
  const t = convexTest(schema, modules);
  register(t);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const workspaceId = await t.mutation(
    internal.workspaces.Provisioning.provision,
    { slug: "agent-card-actions", name: "Agent cards", assignments: [] },
  );
  const otherWorkspaceId = await t.mutation(
    internal.workspaces.Provisioning.provision,
    { slug: "other-agent-cards", name: "Other cards", assignments: [] },
  );
  await t.run(async (ctx) => {
    await ctx.db.insert("workspaceMembers", { workspaceId, userId });
    await ctx.db.insert("workspaceMembers", {
      workspaceId: otherWorkspaceId,
      userId,
    });
  });
  const user = t.withIdentity({ subject: userId });
  const grant = await user.mutation(api.AgentAccess.grant, {
    workspaceId,
    label: "Card agent",
  });
  const narrowToken = crypto.randomUUID() + crypto.randomUUID();
  await t.run(async (ctx) =>
    ctx.db.insert("agentGrants", {
      workspaceId,
      userId,
      documentIds: [],
      canvasRead: true,
      label: "Narrow reader",
      tokenHash: await hashSecret(narrowToken),
      revoked: false,
    }),
  );
  const otherCard = await user.mutation(api.Canvas.createDocument, {
    workspaceId: otherWorkspaceId,
    geometry: { x: 0, y: 0, width: 300, height: 200 },
  });
  let sequence = 0;
  const request = async (name: string, args: unknown, token = grant.token) => {
    const response = await t.fetch("/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++sequence,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    return {
      status: response.status,
      body:
        response.status === 200 ? await response.json() : await response.text(),
    };
  };
  const call = async (name: string, args: unknown) => {
    const { status, body } = await request(name, args);
    expect(status).toBe(200);
    expect(body.result.isError).not.toBe(true);
    return JSON.parse(body.result.content[0].text);
  };
  const original = { x: 10, y: 20, width: 320, height: 240 };
  const create = {
    requestId: crypto.randomUUID(),
    card: { kind: "document", geometry: original },
  };
  expect(
    (await request("create_card", create, narrowToken)).body.result.isError,
  ).toBe(true);
  const created = await call("create_card", create);
  expect(created.status).toBe("applied");
  expect(await call("create_card", create)).toEqual(created);
  expect(
    (
      await call("create_card", {
        ...create,
        card: { kind: "document", geometry: { ...original, x: 99 } },
      })
    ).status,
  ).toBe("rejected");
  const cardId = created.id;
  const canvas = await call("read_canvas", {});
  expect(canvas.elements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: cardId, geometry: original }),
    ]),
  );
  const next = { x: 40, y: 60, width: 500, height: 300 };
  const move = {
    requestId: crypto.randomUUID(),
    id: cardId,
    generation: 1,
    expectedGeometry: original,
    geometry: next,
  };
  const moved = await call("set_card_geometry", move);
  expect(moved.status).toBe("applied");
  expect(await call("set_card_geometry", move)).toEqual(moved);
  expect(
    (
      await call("set_card_geometry", {
        ...move,
        geometry: { ...next, x: 80 },
      })
    ).status,
  ).toBe("rejected");
  expect(
    (await call("read_canvas", {})).elements.find(
      (element: { id?: string }) => element.id === cardId,
    ).geometry,
  ).toEqual(next);
  const undoMove = await call("reverse_card_action", {
    actionId: move.requestId,
    requestId: crypto.randomUUID(),
    revision: moved.revision,
    undo: true,
  });
  expect(undoMove.status).toBe("applied");
  expect(
    (await call("read_canvas", {})).elements.find(
      (element: { id?: string }) => element.id === cardId,
    ).geometry,
  ).toEqual(original);
  const humanGeometry = { x: 90, y: 110, width: 320, height: 240 };
  await user.mutation(api.Canvas.changeDocument, {
    workspaceId,
    id: cardId,
    generation: 1,
    change: { kind: "geometry", geometry: humanGeometry },
  });
  expect(
    (
      await call("set_card_geometry", {
        requestId: crypto.randomUUID(),
        id: cardId,
        generation: 1,
        expectedGeometry: original,
        geometry: next,
      })
    ).status,
  ).toBe("obsolete");
  expect(
    (await call("read_canvas", {})).elements.find(
      (element: { id?: string }) => element.id === cardId,
    ).geometry,
  ).toEqual(humanGeometry);
  await user.mutation(api.Canvas.changeDocument, {
    workspaceId,
    id: cardId,
    generation: 1,
    change: { kind: "geometry", geometry: original },
  });
  const deletion = {
    requestId: crypto.randomUUID(),
    id: cardId,
    generation: 1,
  };
  const deleted = await call("delete_card", deletion);
  expect(deleted.status).toBe("applied");
  expect(await call("delete_card", deletion)).toEqual(deleted);
  expect(
    (await call("read_canvas", {})).elements.some(
      (element: { id?: string }) => element.id === cardId,
    ),
  ).toBe(false);
  expect(
    (
      await call("reverse_card_action", {
        actionId: deletion.requestId,
        requestId: crypto.randomUUID(),
        revision: deleted.revision,
        undo: true,
      })
    ).status,
  ).toBe("applied");
  expect(
    (await call("read_canvas", {})).elements.some(
      (element: { id?: string }) => element.id === cardId,
    ),
  ).toBe(true);
  expect(
    (
      await call("delete_card", {
        requestId: crypto.randomUUID(),
        id: cardId,
        generation: 1,
      })
    ).status,
  ).toBe("obsolete");
  expect(
    (
      await call("delete_card", {
        requestId: crypto.randomUUID(),
        id: otherCard,
        generation: 1,
      })
    ).status,
  ).toBe("obsolete");
  const webCreate = {
    requestId: crypto.randomUUID(),
    card: {
      kind: "web_page",
      url: "https://example.com/article",
      geometry: { x: 500, y: 0, width: 300, height: 176 },
    },
  };
  const web = await call("create_card", webCreate);
  expect(web.status).toBe("applied");
  expect(await call("create_card", webCreate)).toEqual(web);
  expect((await call("read_canvas", {})).elements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "web_page", id: web.id }),
    ]),
  );
  expect(
    (
      await call("set_card_geometry", {
        requestId: crypto.randomUUID(),
        id: web.id,
        generation: 1,
        expectedGeometry: webCreate.card.geometry,
        geometry: { x: 600, y: 20, width: 340, height: 200 },
      })
    ).status,
  ).toBe("applied");
  expect(
    (
      await call("delete_card", {
        requestId: crypto.randomUUID(),
        id: web.id,
        generation: 1,
      })
    ).status,
  ).toBe("applied");
  expect(
    (await call("read_canvas", {})).elements.some(
      (element: { id?: string }) => element.id === web.id,
    ),
  ).toBe(false);
  const imageId = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob(["image"], { type: "image/png" }),
    );
    const uploadId = await ctx.db.insert("imageUploadIntents", {
      workspaceId,
      userId,
      storageId,
      name: "Sample image",
    });
    return ctx.db.insert("canvasImages", {
      workspaceId,
      userId,
      uploadId,
      storageId,
      name: "Sample image",
      geometry: { x: 0, y: 400, width: 300, height: 200 },
      generation: 1,
      removed: false,
    });
  });
  expect((await call("read_canvas", {})).elements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "image",
        id: imageId,
        name: "Sample image",
      }),
    ]),
  );
  expect(
    (
      await call("set_card_geometry", {
        requestId: crypto.randomUUID(),
        id: imageId,
        generation: 1,
        expectedGeometry: { x: 0, y: 400, width: 300, height: 200 },
        geometry: { x: 50, y: 400, width: 360, height: 240 },
      })
    ).status,
  ).toBe("applied");
  expect(
    (
      await call("delete_card", {
        requestId: crypto.randomUUID(),
        id: imageId,
        generation: 1,
      })
    ).status,
  ).toBe("applied");
  expect(
    (await call("read_canvas", {})).elements.some(
      (element: { id?: string }) => element.id === imageId,
    ),
  ).toBe(false);
  await user.mutation(api.AgentAccess.revoke, { grantId: grant.grantId });
  expect((await request("read_canvas", {})).status).toBe(401);
});

afterEach(() => vi.useRealTimers());
test("MCP activity renews an expiring agent lease without browser Presence or cross-workspace disclosure", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  register(t);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const owner = t.withIdentity({ subject: userId });
  const workspaceId = await t.mutation(
    internal.workspaces.Provisioning.provision,
    { slug: "agent-presence-a", name: "A", assignments: [] },
  );
  const otherWorkspaceId = await t.mutation(
    internal.workspaces.Provisioning.provision,
    { slug: "agent-presence-b", name: "B", assignments: [] },
  );
  await t.run(async (ctx) => {
    await ctx.db.insert("workspaceMembers", { workspaceId, userId });
    await ctx.db.insert("workspaceMembers", {
      workspaceId: otherWorkspaceId,
      userId,
    });
  });
  const grant = await owner.mutation(api.AgentAccess.grant, {
    workspaceId,
    label: "Research agent",
  });
  const room = { context: { kind: "canvas" as const, id: workspaceId } };
  const otherRoom = {
    context: { kind: "canvas" as const, id: otherWorkspaceId },
  };
  const read = () => owner.query(api.Presence.agents, room);
  expect(await read()).toEqual([]);
  const request = (token: string, method = "ping") =>
    t.fetch("/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method }),
    });
  expect((await request("wrong-token")).status).toBe(401);
  expect(await read()).toEqual([]);
  expect((await request(grant.token)).status).toBe(200);
  expect(await read()).toEqual([
    { id: grant.grantId, label: "Research agent" },
  ]);
  expect(await owner.query(api.Presence.agents, otherRoom)).toEqual([]);
  await expect(t.query(api.Presence.roster, room)).rejects.toThrow(
    "access denied",
  );
  await vi.advanceTimersByTimeAsync(29_000);
  expect((await request(grant.token)).status).toBe(200);
  await vi.advanceTimersByTimeAsync(1_000);
  await t.mutation(internal.agentAccess.Tools.expirePresence, {
    grantId: grant.grantId,
  });
  expect(await read()).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(29_001);
  await t.mutation(internal.agentAccess.Tools.expirePresence, {
    grantId: grant.grantId,
  });
  expect(await read()).toEqual([]);
  expect((await request(grant.token)).status).toBe(200);
  expect(await read()).toHaveLength(1);
  await owner.mutation(api.AgentAccess.revoke, { grantId: grant.grantId });
  expect(await read()).toEqual([]);
  expect((await request(grant.token)).status).toBe(401);
});
