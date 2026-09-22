import { expect, test } from "vitest";
import { droppedUrl } from "./UrlDrops";

test("browser link payloads select the first public-looking HTTP URL", () => {
  const data = {
    getData: (type: string) =>
      type === "text/uri-list"
        ? "# browser metadata\nhttps://example.com/page\nhttps://example.com/other"
        : "",
  };
  expect(droppedUrl(data)).toBe("https://example.com/page");
  expect(
    droppedUrl({
      getData: (type) =>
        type === "text/plain" ? " https://example.com/photo.png " : "",
    }),
  ).toBe("https://example.com/photo.png");
  expect(
    droppedUrl({
      getData: (type) => (type === "text/plain" ? "javascript:alert(1)" : ""),
    }),
  ).toBeNull();
});
