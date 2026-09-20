import { v } from "convex/values";
export const message=v.object({direction:v.optional(v.union(v.literal("incoming"),v.literal("outgoing"),v.literal("unknown"))),replyTo:v.optional(v.array(v.string())),intentId:v.optional(v.string()),id:v.string(),from:v.string(),to:v.array(v.string()),subject:v.optional(v.string()),text:v.string(),sentAt:v.optional(v.string())});
export const thread=v.object({providerId:v.string(),subject:v.string(),messages:v.array(message),truncated:v.boolean()});
export const sendStatus=v.union(v.literal("pending"),v.literal("sending"),v.literal("sent"),v.literal("failed"),v.literal("unknown"));
