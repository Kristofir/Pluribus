import { screenshotFormat } from "./sources/Screenshot";
/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";
import { scrapePage, captureFailureMessage } from "./sources/Firecrawl";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function mockResponse(body: unknown, status = 200) {
  vi.stubEnv("FIRECRAWL_API_KEY", "test-key");
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

test.each([undefined, "Extract the title"])(
  "requests and parses a capture with prompt %s",
  async (prompt) => {
    const json = prompt
      ? { kind: "text", text: "Example", columns: [], rows: [] }
      : { title: "Example" };
    const fetch = mockResponse({
      success: true,
      data: {
        markdown: "# Example",
        json,
        metadata: { title: "Example" },
      },
    });
    expect(await scrapePage({ url: "https://example.com", prompt })).toEqual({
      content: "# Example",
      title: "Example",
      data: JSON.stringify(json),
      ...(prompt ? { extractionFormat: "inferred-v1" } : {}),
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.firecrawl.dev/v2/scrape");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(init.redirect).toBe("error");
    expect(JSON.parse(init.body)).toEqual({
      url: "https://example.com/",
      formats: prompt
        ? [
            screenshotFormat,
            "markdown",
            expect.objectContaining({
              type: "json",
              prompt: expect.stringContaining(prompt),
              schema: expect.any(Object),
            }),
          ]
        : [screenshotFormat, "markdown"],
      onlyMainContent: true,
      timeout: 25000,
      proxy: "basic",
    });
  },
);

test.each([
  [401, "API key"],
  [402, "credits"],
  [403, "unsupported"],
  [429, "rate-limiting"],
  [500, "HTTP 500"],
  [504, "timed out"],
])(
  "explains HTTP %s without leaking the response body",
  async (status, message) => {
    mockResponse({ error: "sensitive-provider-body" }, Number(status));
    const error = await scrapePage({ url: "https://example.com" }).catch(
      (error) => error,
    );
    expect(captureFailureMessage(error)).toContain(message);
    expect(captureFailureMessage(error)).not.toContain(
      "sensitive-provider-body",
    );
  },
);

test.each([{ kind: "table", text: "", columns: ["Name"], rows: [] }])(
  "accepts an empty extraction result with usable Markdown: %j",
  async (json) => {
    mockResponse({ success: true, data: { markdown: "Page content", json } });
    expect(
      await scrapePage({
        url: "https://example.com",
        prompt: "Find matching entries",
      }),
    ).toMatchObject({ content: "Page content", data: JSON.stringify(json) });
  },
);

test("rejects missing configuration without an HTTP call", async () => {
  vi.stubEnv("FIRECRAWL_API_KEY", "");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const error = await scrapePage({ url: "https://example.com" }).catch(
    (error) => error,
  );
  expect(captureFailureMessage(error)).toContain("not configured");
  expect(fetch).not.toHaveBeenCalled();
});

test("handles timeout, invalid JSON and oversized responses safely", async () => {
  mockResponse({});
  vi.mocked(fetch).mockRejectedValueOnce(
    new DOMException("secret", "TimeoutError"),
  );
  expect(
    captureFailureMessage(
      await scrapePage({ url: "https://example.com" }).catch((e) => e),
    ),
  ).toContain("timed out");
  vi.mocked(fetch).mockResolvedValueOnce(new Response("not json"));
  expect(
    captureFailureMessage(
      await scrapePage({ url: "https://example.com" }).catch((e) => e),
    ),
  ).toContain("invalid response");
  vi.mocked(fetch).mockResolvedValueOnce(new Response("x".repeat(500001)));
  expect(
    captureFailureMessage(
      await scrapePage({ url: "https://example.com" }).catch((e) => e),
    ),
  ).toContain("too large");
  expect(captureFailureMessage(new Error("secret"))).not.toContain("secret");
});

test("the capture action persists an HTTP failure and retains the previous capture", async () => {
  mockResponse({ error: "unsupported site" }, 403);
  const t = convexTest(schema, modules);
  const previous = {
    id: "previous",
    capturedAt: 1,
    content: "Original content",
  };
  const id = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Test",
      slug: "test",
    });
    await ctx.db.insert("workspaceMembers", { userId, workspaceId });
    return ctx.db.insert("sources", {
      workspaceId,
      userId,
      url: "https://example.com/",
      revision: 2,
      status: "queued",
      capture: previous,
    });
  });
  await t.action(internal.sources.Jobs.fetch, { id, revision: 2 });
  const row = await t.run((ctx) => ctx.db.get(id));
  expect(row?.status).toBe("failed");
  expect(row?.error).toContain("unsupported");
  expect(row?.capture).toEqual(previous);

  mockResponse({
    success: true,
    data: { markdown: "New content", metadata: { title: "New title" } },
  });
  await t.run((ctx) => ctx.db.patch(id, { status: "queued", revision: 3 }));
  await t.action(internal.sources.Jobs.fetch, { id, revision: 3 });
  const ready = await t.run((ctx) => ctx.db.get(id));
  expect(ready?.status).toBe("ready");
  expect(ready?.error).toBeUndefined();
  expect(ready?.capture?.content).toBe("New content");
});

// Explicit opt-in: uses provider credits and a server-side key, never workspace data.
test.skipIf(process.env.FIRECRAWL_LIVE_TEST !== "1")(
  "live Firecrawl captures example.com through the real adapter",
  async () => {
    const result = await scrapePage({ url: "https://example.com/" });
    expect(result.content).toContain("Example Domain");
  },
  40000,
);

test("table extraction sends an explicit schema and accepts matching rows or no matches", async () => {
  const table = { columns: ["Product", "Price"] };
  for (const rows of [[{ Product: "A", Price: null }], []]) {
    const fetch = mockResponse({
      success: true,
      data: { markdown: "Page", json: { rows } },
    });
    const result = await scrapePage({
      url: "https://example.com",
      prompt: "Extract products and prices",
      table,
    });
    expect(JSON.parse(result.data!)).toEqual({ rows });
    const format = JSON.parse(fetch.mock.calls[0][1].body).formats.find(
      (format: { type?: string }) => format.type === "json",
    );
    expect(format.schema.properties.rows.items).toEqual({
      type: "object",
      additionalProperties: false,
      required: table.columns,
      properties: {
        Product: { type: ["string", "null"], maxLength: 10000 },
        Price: { type: ["string", "null"], maxLength: 10000 },
      },
    });
    expect(format.prompt).toContain("Extract products and prices");
  }
});

test.each([
  {
    requestType: "Return as CSV table",
    outputFormat: "CSV",
    schemaProvided: true,
  },
  { rows: [{ Wrong: "value" }] },
  { rows: [{}] },
  { rows: [{ Name: "value", Extra: "unexpected" }] },
  { rows: [{ Name: 42 }] },
  { rows: [{ Name: { nested: "value" } }] },
  { rows: [{ Name: "x".repeat(10001) }] },
  { rows: Array.from({ length: 201 }, () => ({ Name: "A" })) },
])(
  "rejects invalid table output without treating instruction metadata as page data: %j",
  async (json) => {
    mockResponse({ success: true, data: { markdown: "Page", json } });
    await expect(
      scrapePage({
        url: "https://example.com",
        prompt: "Extract names",
        table: { columns: ["Name"] },
      }),
    ).rejects.toThrow("Invalid table extraction");
  },
);

test.each([
  "Return as CSV table",
  "CSV",
  "Please output as JSON",
  "Format this as a table",
])(
  "infers useful page output from format-only instruction %s in one call",
  async (prompt) => {
    const json = {
      kind: "table",
      text: "",
      columns: ["Fact", "Value"],
      rows: [["Title", "Example"]],
    };
    const fetch = mockResponse({
      success: true,
      data: { markdown: "Example", json },
    });
    expect(
      await scrapePage({ url: "https://example.com", prompt }),
    ).toMatchObject({
      data: JSON.stringify(json),
      extractionFormat: "inferred-v1",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(fetch.mock.calls[0][1].body).formats.find(
        (format: { type?: string }) => format.type === "json",
      ).prompt,
    ).toContain(prompt);
  },
);

test.each([
  {
    requestType: "Return as CSV table",
    outputFormat: "CSV",
    schemaProvided: true,
  },
  { kind: "table", text: "", columns: ["Name"], rows: [["A", "B"]] },
  { kind: "text", text: "", columns: [], rows: [] },
])("rejects invalid inferred output %j", async (json) => {
  mockResponse({ success: true, data: { markdown: "Page", json } });
  await expect(
    scrapePage({ url: "https://example.com", prompt: "Summarize this page" }),
  ).rejects.toThrow("Invalid inferred extraction");
});

test("passes explicit names in instructions to the inference call without a second request", async () => {
  const prompt = "List products with columns Item, Cost, Notes in that order";
  const json = {
    kind: "table",
    text: "",
    columns: ["Item", "Cost", "Notes"],
    rows: [["A", null, "Available"]],
  };
  const fetch = mockResponse({
    success: true,
    data: { markdown: "Page", json },
  });
  expect(
    JSON.parse(
      (await scrapePage({ url: "https://example.com", prompt })).data!,
    ),
  ).toEqual(json);
  expect(fetch).toHaveBeenCalledTimes(1);
  const format = JSON.parse(fetch.mock.calls[0][1].body).formats.find(
    (format: { type?: string }) => format.type === "json",
  );
  expect(format.prompt).toContain(prompt);
  expect(format.prompt).toContain(
    "honor explicitly named columns and their order",
  );
  expect(format.schema.required).toEqual(["kind", "text", "columns", "rows"]);
});
