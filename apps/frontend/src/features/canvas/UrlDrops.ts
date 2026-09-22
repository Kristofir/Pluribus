/** Browser image drags often contain both a file and an image URL. Prefer the URL. */
export function droppedUrl(data: Pick<DataTransfer, "getData">): string | null {
  const html = data.getData("text/html");
  if (html) {
    const image = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("img[src]");
    const src = image?.getAttribute("src");
    if (src && httpUrl(src)) return src;
  }
  for (const type of ["text/uri-list", "text/plain"]) {
    const text = data.getData(type);
    const candidate =
      type === "text/uri-list"
        ? text.split(/\r?\n/).find((line) => line && !line.startsWith("#"))
        : text.trim();
    if (candidate && httpUrl(candidate)) return candidate;
  }
  return null;
}

export function httpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
