"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { object, providerJson, text } from "../integrations/Http";

const model = "gpt-4.1-mini";

function responseDescription(raw: unknown) {
  const response = object(raw);
  if (response.status !== "completed" || !Array.isArray(response.output))
    throw new Error("Image description unavailable");
  const parts: string[] = [];
  for (const item of response.output) {
    const message = object(item);
    if (message.type === "reasoning") continue;
    if (
      message.type !== "message" ||
      message.role !== "assistant" ||
      !Array.isArray(message.content)
    )
      throw new Error("Image description unavailable");
    for (const part of message.content) {
      const content = object(part);
      if (content.type === "output_text") parts.push(text(content.text, 1000));
    }
  }
  const description = parts.join(" ").trim().slice(0, 500);
  if (!description) throw new Error("Image description unavailable");
  return description;
}

/** Best-effort AI metadata; provider failures never roll back the image card. */
export const generate = internalAction({
  args: { imageId: v.id("canvasImages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      await ctx.runMutation(internal.canvas.ImageDescription.complete, {
        ...args,
        status: "unavailable",
      });
      return null;
    }
    try {
      const prepared = await ctx.runMutation(
        internal.canvas.ImageDescription.begin,
        args,
      );
      if (!prepared) return null;
      const file = await ctx.storage.get(prepared.storageId);
      if (!file) throw new Error("Image unavailable");
      const encoded = Buffer.from(await file.arrayBuffer()).toString("base64");
      const result = await providerJson(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            instructions:
              "Describe the visible image in one concise, neutral sentence. Do not infer private traits or facts that are not visible.",
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: "Write an AI description for this image.",
                  },
                  {
                    type: "input_image",
                    image_url: `data:${prepared.contentType};base64,${encoded}`,
                    detail: "low",
                  },
                ],
              },
            ],
            max_output_tokens: 120,
            store: false,
            stream: false,
          }),
        },
        100000,
        45000,
      );
      await ctx.runMutation(internal.canvas.ImageDescription.complete, {
        ...args,
        status: "ready",
        description: responseDescription(result),
      });
    } catch {
      await ctx.runMutation(internal.canvas.ImageDescription.complete, {
        ...args,
        status: "failed",
      });
    }
    return null;
  },
});
