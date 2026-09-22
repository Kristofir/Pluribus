import { expect, test } from "vitest";
import { imageType, isPageType, publicIpv4 } from "./canvas/UrlImportPolicy";

test("only public IPv4 destinations are eligible for a pinned connection", () => {
  for (const address of [
    "10.0.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "192.0.0.1",
    "192.0.2.1",
    "203.0.113.1",
    "1.1.1",
  ])
    expect(publicIpv4(address)).toBe(false);
  expect(publicIpv4("1.1.1.1")).toBe(true);
  expect(publicIpv4("192.0.77.2")).toBe(true);
});

test("image detection uses bytes, not URL extension or claimed MIME type", () => {
  expect(imageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
    "image/png",
  );
  expect(imageType(new Uint8Array([255, 216, 255]))).toBe("image/jpeg");
  expect(imageType(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
  expect(imageType(new TextEncoder().encode("RIFFxxxxWEBP"))).toBe(
    "image/webp",
  );
  expect(imageType(new TextEncoder().encode("<html>"))).toBeNull();
});

test("HTML and text responses enter the Web Page path", () => {
  expect(isPageType("text/html")).toBe(true);
  expect(isPageType("application/xhtml+xml")).toBe(true);
  expect(isPageType("text/plain")).toBe(true);
  expect(isPageType("image/png")).toBe(false);
  expect(isPageType("application/pdf")).toBe(false);
});
