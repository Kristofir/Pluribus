import type { ActionCtx } from "../_generated/server";
import { agentTools, callAgentTool } from "../agentAccess/ToolProtocol";
import { object, providerJson, text } from "../integrations/Http";

type ChatMessage = { role: "user" | "assistant"; text: string };
type AgentResult = { text: string; tools: string[] };

const instructions = `You are the Pluribus workspace agent. Help the user create content and organize the current canvas.

You can read and change the board only through the supplied tools. Read the canvas before any board operation. Read a Note before editing it. Use UUID request IDs. Respect exact generations, versions, expected geometry, and tool conflicts. If a write conflicts, reread once and decide whether the user's intent is still safe. Never claim a change succeeded unless the tool result says it was applied. Keep your final response concise and say what changed. Ask a brief question when the user's desired content or layout cannot be inferred safely.`;

export async function runOpenAiBoardAgent(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  token: string,
  messages: ChatMessage[],
): Promise<AgentResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI is not configured");
  const input: unknown[] = messages.map((message) => ({
    role: message.role,
    content: message.text,
  }));
  const usedTools: string[] = [];
  let calls = 0;
  for (let step = 0; step < 8; step++) {
    const response = object(
      await providerJson(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            instructions,
            input,
            tools: agentTools.map((tool) => ({
              type: "function",
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema,
            })),
            tool_choice: "auto",
            max_output_tokens: 1400,
            store: false,
            stream: false,
          }),
        },
        2 * 1024 * 1024,
        60000,
      ),
    );
    if (!Array.isArray(response.output))
      throw new Error("OpenAI returned an invalid response");
    const functionCalls: Array<{
      type: "function_call";
      call_id: string;
      name: string;
      arguments: string;
    }> = [];
    const answer: string[] = [];
    for (const rawItem of response.output) {
      const item = object(rawItem);
      if (item.type === "function_call") {
        functionCalls.push({
          type: "function_call",
          call_id: text(item.call_id, 300),
          name: text(item.name, 100),
          arguments: text(item.arguments, 50000),
        });
      } else if (item.type === "message" && Array.isArray(item.content)) {
        for (const rawPart of item.content) {
          const part = object(rawPart);
          if (part.type === "output_text") answer.push(text(part.text, 20000));
          else if (part.type === "refusal")
            answer.push(text(part.refusal, 20000));
        }
      }
    }
    if (!functionCalls.length) {
      const finalText = answer.join("").trim();
      if (!finalText) throw new Error("OpenAI returned an empty response");
      return { text: finalText, tools: usedTools };
    }
    input.push(...response.output);
    for (const call of functionCalls) {
      calls++;
      if (calls > 16)
        throw new Error("The request needed too many board operations");
      usedTools.push(call.name);
      let output: string;
      try {
        const parsed: unknown = JSON.parse(call.arguments);
        output = JSON.stringify(
          await callAgentTool(ctx, token, call.name, parsed),
        );
      } catch {
        output = JSON.stringify({
          error:
            "The operation was rejected. Reread current state before deciding whether to retry with a new request ID.",
        });
      }
      input.push({
        type: "function_call_output",
        call_id: call.call_id,
        output,
      });
    }
  }
  throw new Error("The request needed too many steps");
}
