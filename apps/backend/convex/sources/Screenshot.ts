import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";

export const screenshotViewport = { width: 1280, height: 800 } as const;
export const screenshotFormat = {
  type: "screenshot",
  fullPage: false,
  quality: 80,
  viewport: screenshotViewport,
} as const;
const maxBytes = 5 * 1024 * 1024;

/** Download only provider asset hosts; never follow redirects to arbitrary page-controlled URLs. */
export async function downloadScreenshot(raw: string): Promise<Blob> {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !(
      url.hostname === "storage.googleapis.com" ||
      url.hostname === "firecrawl.dev" ||
      url.hostname.endsWith(".firecrawl.dev")
    )
  )
    throw new Error("Unsupported screenshot host");
  const response = await fetch(url.href, {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || !response.body)
    throw new Error("Screenshot download failed");
  const type = response.headers.get("content-type")?.split(";")[0];
  if (type !== "image/png" && type !== "image/jpeg")
    throw new Error("Unsupported screenshot type");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Screenshot too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const dimensions = imageDimensions(bytes, type);
  if (
    dimensions?.width !== screenshotViewport.width ||
    dimensions.height !== screenshotViewport.height
  )
    throw new Error("Screenshot does not match viewport");
  return new Blob([bytes], { type });
}

/** Read raster dimensions before storing; reject unexpected full-page images. */
function imageDimensions(bytes: Uint8Array, type: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === "image/png") {
    if (
      bytes.length < 24 ||
      view.getUint32(0) !== 0x89504e47 ||
      view.getUint32(4) !== 0x0d0a1a0a ||
      view.getUint32(12) !== 0x49484452
    )
      return null;
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i++] !== 0xff) return null;
    while (bytes[i] === 0xff) i++;
    const marker = bytes[i++];
    if (marker === 0xda || marker === 0xd9) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (i + 2 > bytes.length) return null;
    const length = view.getUint16(i);
    if (length < 2 || i + length > bytes.length) return null;
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
        0xcf,
      ].includes(marker) &&
      length >= 7
    )
      return { height: view.getUint16(i + 3), width: view.getUint16(i + 5) };
    i += length;
  }
  return null;
}

/** Image-only failures do not invalidate useful text from the same scrape. */
export async function storeScreenshot(ctx: ActionCtx, url?: string) {
  let storageId: Id<"_storage"> | undefined;
  try {
    if (!url) throw new Error("Missing screenshot");
    storageId = await ctx.storage.store(await downloadScreenshot(url));
    await ctx.runMutation(internal.sources.Jobs.registerScreenshot, {
      storageId,
    });
    return { screenshot: { storageId, ...screenshotViewport } };
  } catch {
    // No completion can reference this file yet. A registered pending asset is
    // also covered by scheduled cleanup if this best-effort delete fails.
    if (storageId) {
      try {
        await ctx.storage.delete(storageId);
      } catch {
        /* cleanup owns registered leftovers */
      }
    }
    return {
      screenshotError:
        "Page content captured, but its screenshot is unavailable.",
    };
  }
}

/** Pending assets expire after the capture deadline; accepted assets may be snapshotted. */
export async function registerScreenshot(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) {
  const existing = await ctx.db
    .query("sourceScreenshotAssets")
    .withIndex("by_storage", (q) => q.eq("storageId", storageId))
    .unique();
  if (!existing)
    await ctx.db.insert("sourceScreenshotAssets", {
      storageId,
      accepted: false,
    });
  await ctx.scheduler.runAfter(
    300000,
    internal.sources.Jobs.cleanupScreenshot,
    { storageId },
  );
}
export async function discardPendingScreenshot(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) {
  const asset = await ctx.db
    .query("sourceScreenshotAssets")
    .withIndex("by_storage", (q) => q.eq("storageId", storageId))
    .unique();
  if (asset && !asset.accepted) {
    if (await ctx.db.system.get(storageId)) await ctx.storage.delete(storageId);
    await ctx.db.delete(asset._id);
  }
}
export async function acceptScreenshot(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) {
  const asset = await ctx.db
    .query("sourceScreenshotAssets")
    .withIndex("by_storage", (q) => q.eq("storageId", storageId))
    .unique();
  if (!asset) throw new Error("Screenshot upload is unavailable");
  await ctx.db.patch(asset._id, { accepted: true });
}
