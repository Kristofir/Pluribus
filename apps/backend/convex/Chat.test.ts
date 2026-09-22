import { afterEach, expect, test, vi } from "vitest";

const { callAgentTool } = vi.hoisted(() => ({ callAgentTool: vi.fn() }));
vi.mock("./agentAccess/ToolProtocol", () => ({
  agentTools: [
    {
      name: "read_canvas",
      description: "Read canvas",
      inputSchema: { type: "object", properties: {} },
    },
  ],
  callAgentTool,
}));

import { runOpenAiBoardAgent } from "./chat/OpenAiBoardAgent";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  callAgentTool.mockReset();
});

function response(output: unknown[]) {
  return new Response(JSON.stringify({ status: "completed", output }));
}

test("returns a concise assistant message without running a board tool", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const fetch = vi.fn().mockResolvedValue(
    response([
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Done." }],
      },
    ]),
  );
  vi.stubGlobal("fetch", fetch);
  await expect(
    runOpenAiBoardAgent({} as never, "token", [
      { role: "user", text: "What is here?" },
    ]),
  ).resolves.toEqual({ text: "Done.", tools: [] });
  expect(callAgentTool).not.toHaveBeenCalled();
});

test("feeds guarded tool results back to OpenAI before completing", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  callAgentTool.mockResolvedValue({ workspaceId: "workspace", elements: [] });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      response([
        {
          type: "function_call",
          call_id: "call_1",
          name: "read_canvas",
          arguments: "{}",
        },
      ]),
    )
    .mockResolvedValueOnce(
      response([
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "The board is empty." }],
        },
      ]),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(
    runOpenAiBoardAgent({} as never, "token", [
      { role: "user", text: "Describe the board" },
    ]),
  ).resolves.toEqual({
    text: "The board is empty.",
    tools: ["read_canvas"],
  });
  expect(callAgentTool).toHaveBeenCalledWith(
    expect.anything(),
    "token",
    "read_canvas",
    {},
  );
  const secondBody = JSON.parse(fetch.mock.calls[1][1].body as string);
  expect(secondBody.input.at(-1)).toEqual({
    type: "function_call_output",
    call_id: "call_1",
    output: JSON.stringify({ workspaceId: "workspace", elements: [] }),
  });
});
