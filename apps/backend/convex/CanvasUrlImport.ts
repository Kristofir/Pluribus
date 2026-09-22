"use node";

import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { publicSourceUrl } from "./sources/Firecrawl";
import { imageLimits } from "@pluribus/core/canvas/domain";
import { imageType, isPageType, publicIpv4 } from "./canvas/UrlImportPolicy";

/** Pin a vetted public IPv4 address for the connection; redirects cannot change the destination. */
async function fetchImport(
  url: URL,
): Promise<
  { kind: "webPage" } | { kind: "image"; bytes: Buffer; type: string }
> {
  const addresses = await lookup(url.hostname, { all: true });
  const ipv4 = addresses.filter((entry) => entry.family === 4);
  if (!ipv4.length || ipv4.some((entry) => !publicIpv4(entry.address)))
    throw new Error("Use a publicly accessible URL");
  return new Promise((resolve, reject) => {
    const connect = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = connect(
      {
        hostname: ipv4[0].address,
        family: 4,
        port: url.protocol === "https:" ? 443 : 80,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          host: url.hostname,
          accept:
            "image/webp,image/png,image/jpeg,image/gif,text/html;q=0.8,*/*;q=0.5",
        },
        servername: url.hostname,
        timeout: 12000,
      },
      (response) => {
        if (
          !response.statusCode ||
          response.statusCode < 200 ||
          response.statusCode >= 300
        ) {
          response.destroy();
          reject(new Error("The URL could not be fetched. Try its final URL."));
          return;
        }
        const mime = String(response.headers["content-type"] ?? "")
          .split(";")[0]
          .trim()
          .toLowerCase();
        if (isPageType(mime)) {
          response.destroy();
          resolve({ kind: "webPage" });
          return;
        }
        const length = Number(response.headers["content-length"] ?? 0);
        if (length > imageLimits.maxBytes) {
          response.destroy();
          reject(new Error("Image exceeds 10 MB"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > imageLimits.maxBytes) {
            response.destroy(new Error("Image exceeds 10 MB"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          const bytes = Buffer.concat(chunks);
          const type = imageType(bytes);
          if (
            !type ||
            (mime && mime !== type && mime !== "application/octet-stream")
          )
            reject(
              new Error(
                "URL must return a web page or PNG, JPEG, GIF, or WebP image",
              ),
            );
          else resolve({ kind: "image", bytes, type });
        });
      },
    );
    const deadline = setTimeout(
      () => req.destroy(new Error("URL fetch timed out")),
      12000,
    );
    req.on("close", () => clearTimeout(deadline));
    req.on("timeout", () => req.destroy(new Error("URL fetch timed out")));
    req.on("error", reject);
    req.end();
  });
}

export const importUrl = action({
  args: { workspaceId: v.id("workspaces"), url: v.string() },
  returns: v.union(
    v.object({ kind: v.literal("webPage"), url: v.string() }),
    v.object({
      kind: v.literal("image"),
      uploadId: v.id("imageUploadIntents"),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    | { kind: "webPage"; url: string }
    | { kind: "image"; uploadId: Id<"imageUploadIntents"> }
  > => {
    await ctx.runQuery(internal.canvas.UrlImportAccess.authorize, {
      workspaceId: args.workspaceId,
    });
    const url = new URL(publicSourceUrl(args.url.trim()));
    if (url.hostname.endsWith("."))
      throw new Error("Use a public URL without a trailing dot");
    const result = await fetchImport(url);
    if (result.kind === "webPage")
      return { kind: "webPage" as const, url: url.href };
    const rawName = url.pathname.split("/").pop() || "Image";
    let name = rawName;
    try {
      name = decodeURIComponent(rawName);
    } catch {
      // A malformed name does not invalidate an otherwise fetchable image.
    }
    name = name.slice(0, 120);
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array(result.bytes)], { type: result.type }),
    );
    try {
      const uploadId: Id<"imageUploadIntents"> = await ctx.runMutation(
        internal.canvas.UrlImportAccess.register,
        {
          workspaceId: args.workspaceId,
          storageId,
          name,
          contentType: result.type,
        },
      );
      return { kind: "image" as const, uploadId };
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  },
});
