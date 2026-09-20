import { v } from "convex/values";
export const sourceStatus=v.union(v.literal("queued"),v.literal("fetching"),v.literal("ready"),v.literal("failed"));
export const capture=v.object({id:v.string(),capturedAt:v.number(),content:v.string(),data:v.optional(v.string())});
