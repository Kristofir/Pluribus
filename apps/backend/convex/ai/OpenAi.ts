import {
  type TextGeneration,
  type TextGenerationResponse,
  TextGenerationError,
  assertTextGenerationRequest,
} from "@pluribus/core/ai/textGeneration";
import {
  providerJson,
  ProviderHttpError,
  object,
  text as stringValue,
} from "../integrations/Http";

/** Compose inside a Convex action. Construction never contacts OpenAI; generate makes one request. */
export function createOpenAiTextGeneration(): TextGeneration {
  return {
    async generate(request) {
      assertTextGenerationRequest(request);
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new TextGenerationError("not_configured");
      try {
        const response = await providerJson(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: request.model,
              input: request.input,
              instructions: request.instructions,
              max_output_tokens: request.maxOutputTokens,
              store: false,
              stream: false,
            }),
          },
          2 * 1024 * 1024,
          60000,
        );
        return parseResponse(response);
      } catch (error) {
        if (error instanceof TextGenerationError) throw error;
        if (error instanceof ProviderHttpError) {
          const status = error.status;
          throw new TextGenerationError(
            status === 401 || status === 403
              ? "authentication"
              : status === 429
                ? "rate_limited"
                : status === 408 || status === 504
                  ? "timeout"
                  : status >= 500
                    ? "unavailable"
                    : "rejected",
          );
        }
        if (
          error instanceof Error &&
          ["TimeoutError", "AbortError"].includes(error.name)
        )
          throw new TextGenerationError("timeout");
        if (error instanceof TypeError)
          throw new TextGenerationError("unavailable");
        throw new TextGenerationError("invalid_response");
      }
    },
  };
}

/** Responses output can contain reasoning before messages, multiple text parts, or a refusal. */
function parseResponse(raw: unknown): TextGenerationResponse {
  const data = object(raw);
  if (data.status === "failed" || data.status === "cancelled")
    throw new TextGenerationError("rejected");
  if (
    !["completed", "incomplete"].includes(String(data.status)) ||
    !Array.isArray(data.output)
  )
    throw new TextGenerationError("invalid_response");
  const parts: string[] = [],
    refusals: string[] = [];
  for (const item of data.output) {
    const output = object(item);
    if (output.type === "reasoning") continue;
    if (
      output.type !== "message" ||
      output.role !== "assistant" ||
      !Array.isArray(output.content)
    )
      throw new TextGenerationError("invalid_response");
    for (const part of output.content) {
      const content = object(part);
      if (content.type === "output_text") parts.push(stringValue(content.text));
      else if (content.type === "refusal")
        refusals.push(stringValue(content.refusal));
      else throw new TextGenerationError("invalid_response");
    }
  }
  const text = parts.join("");
  if (
    text.length > 100000 ||
    (data.status === "completed" && !text.trim() && !refusals.length)
  )
    throw new TextGenerationError("invalid_response");
  const reason = refusals.length
    ? refusals.join("\n")
    : data.status === "incomplete"
      ? stringValue(object(data.incomplete_details).reason, 200)
      : undefined;
  let usage: TextGenerationResponse["usage"];
  if (data.usage !== undefined && data.usage !== null) {
    const counts = object(data.usage);
    const values = [
      counts.input_tokens,
      counts.output_tokens,
      counts.total_tokens,
    ];
    if (
      !values.every(
        (value) =>
          typeof value === "number" &&
          Number.isSafeInteger(value) &&
          value >= 0,
      )
    )
      throw new TextGenerationError("invalid_response");
    usage = {
      inputTokens: counts.input_tokens as number,
      outputTokens: counts.output_tokens as number,
      totalTokens: counts.total_tokens as number,
    };
  }
  return {
    id: stringValue(data.id, 300),
    model: stringValue(data.model, 200),
    status: refusals.length
      ? "refused"
      : (data.status as "completed" | "incomplete"),
    text,
    ...(reason ? { reason } : {}),
    ...(usage ? { usage } : {}),
  };
}
