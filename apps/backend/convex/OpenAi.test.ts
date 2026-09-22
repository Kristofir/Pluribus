import { afterEach, expect, test, vi } from "vitest";
import { createOpenAiTextGeneration } from "./ai/OpenAi";
const request = {
  model: "test-model",
  input: "Summarize this text",
  instructions: "Be concise",
  maxOutputTokens: 256,
};
const message = (content: unknown[]) => ({
  type: "message",
  role: "assistant",
  content,
});
const response = (output: unknown[]) => ({
  id: "resp_test",
  model: "test-model",
  status: "completed",
  output,
});
function mock(body: unknown, status = 200) {
  vi.stubEnv("OPENAI_API_KEY", "test-secret");
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("port construction is inert; one bounded request returns all text and usage", async () => {
  const fetch = mock({
    ...response([
      { type: "reasoning", summary: [] },
      message([{ type: "output_text", text: "One " }]),
      message([{ type: "output_text", text: "two" }]),
    ]),
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
  });
  const port = createOpenAiTextGeneration();
  expect(fetch).not.toHaveBeenCalled();
  expect(await port.generate(request)).toEqual({
    id: "resp_test",
    model: "test-model",
    status: "completed",
    text: "One two",
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe("https://api.openai.com/v1/responses");
  expect(init.headers.Authorization).toBe("Bearer test-secret");
  expect(init.redirect).toBe("error");
  expect(JSON.parse(init.body)).toEqual({
    model: "test-model",
    input: request.input,
    instructions: "Be concise",
    max_output_tokens: 256,
    store: false,
    stream: false,
  });
});
test("incomplete output is not reported as completed, including an exhausted reasoning budget", async () => {
  mock({
    ...response([]),
    status: "incomplete",
    incomplete_details: { reason: "max_output_tokens" },
  });
  expect(await createOpenAiTextGeneration().generate(request)).toMatchObject({
    status: "incomplete",
    text: "",
    reason: "max_output_tokens",
  });
});
test("refusal is a distinct result", async () => {
  mock(
    response([
      message([{ type: "refusal", refusal: "I cannot help with that." }]),
    ]),
  );
  expect(await createOpenAiTextGeneration().generate(request)).toMatchObject({
    status: "refused",
    reason: "I cannot help with that.",
    text: "",
  });
});
test.each([
  [401, "authentication"],
  [403, "authentication"],
  [429, "rate_limited"],
  [500, "unavailable"],
  [400, "rejected"],
])("HTTP %s is safely classified without retry", async (status, code) => {
  const fetch = mock(
    { error: { message: "test-secret private prompt" } },
    Number(status),
  );
  await expect(
    createOpenAiTextGeneration().generate(request),
  ).rejects.toMatchObject({ code, message: `Text generation failed: ${code}` });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("timeout and network failures never expose provider details or retry", async () => {
  const fetch = mock({});
  fetch.mockRejectedValueOnce(
    new DOMException("private prompt", "TimeoutError"),
  );
  await expect(
    createOpenAiTextGeneration().generate(request),
  ).rejects.toMatchObject({ code: "timeout" });
  fetch.mockRejectedValueOnce(new TypeError("test-secret"));
  await expect(
    createOpenAiTextGeneration().generate(request),
  ).rejects.toMatchObject({ code: "unavailable" });
  expect(fetch).toHaveBeenCalledTimes(2);
});
test.each([
  {},
  response([]),
  { ...response([]), status: "queued" },
  {
    ...response([message([{ type: "output_text", text: "Hi" }])]),
    usage: { input_tokens: -1, output_tokens: 1, total_tokens: 0 },
  },
])("rejects malformed/nonterminal response %#", async (body) => {
  mock(body);
  await expect(
    createOpenAiTextGeneration().generate(request),
  ).rejects.toMatchObject({ code: "invalid_response" });
});
test("missing key and invalid input fail before network", async () => {
  const fetch = mock({});
  vi.stubEnv("OPENAI_API_KEY", "");
  await expect(
    createOpenAiTextGeneration().generate(request),
  ).rejects.toMatchObject({ code: "not_configured" });
  vi.stubEnv("OPENAI_API_KEY", "test-secret");
  for (const change of [
    { input: "" },
    { model: "" },
    { maxOutputTokens: Infinity },
    { maxOutputTokens: 8193 },
    { input: "x".repeat(100001) },
  ])
    await expect(
      createOpenAiTextGeneration().generate({ ...request, ...change }),
    ).rejects.toMatchObject({ code: "invalid_request" });
  expect(fetch).not.toHaveBeenCalled();
});
test("oversized provider response is bounded and sanitized", async () => {
  const fetch = mock({});
  fetch.mockResolvedValueOnce(new Response("x".repeat(2 * 1024 * 1024 + 1)));
  await expect(
    createOpenAiTextGeneration().generate(request),
  ).rejects.toMatchObject({ code: "invalid_response" });
});
