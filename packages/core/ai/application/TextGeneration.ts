/** Caller-selected model and text; authorization and context selection belong to the use case. */
export type TextGenerationRequest = {
  model: string;
  input: string;
  instructions?: string;
  maxOutputTokens: number;
};
export type TextGenerationResponse = {
  id: string;
  model: string;
  status: "completed" | "incomplete" | "refused";
  text: string;
  reason?: string;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
};
/** Outbound port: generate text without coupling application code to a provider SDK. */
export interface TextGeneration {
  generate(request: TextGenerationRequest): Promise<TextGenerationResponse>;
}
export type TextGenerationErrorCode =
  | "invalid_request"
  | "not_configured"
  | "authentication"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "rejected"
  | "invalid_response";
/** Safe failure category; never carries prompts, keys or raw provider error bodies. */
export class TextGenerationError extends Error {
  constructor(readonly code: TextGenerationErrorCode) {
    super(`Text generation failed: ${code}`);
  }
}
export function assertTextGenerationRequest(request: TextGenerationRequest) {
  if (
    !request.model.trim() ||
    request.model.length > 200 ||
    !request.input.trim() ||
    request.input.length + (request.instructions?.length ?? 0) > 100000 ||
    !Number.isInteger(request.maxOutputTokens) ||
    request.maxOutputTokens < 16 ||
    request.maxOutputTokens > 8192
  )
    throw new TextGenerationError("invalid_request");
}
