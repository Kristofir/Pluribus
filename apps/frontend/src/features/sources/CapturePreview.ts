/** A lossy, display-only preview. Never parse truncated provider data or alter a capture. */
export function capturePreview(text: string) {
  let fenced = false;
  const lines = text.split(/\r?\n/).filter((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return false;
    }
    if (fenced) return false;
    const trimmed = line.trim();
    if (!trimmed) return true;
    // Layout/navigation tables are especially noisy in short scraped-page previews.
    if (
      trimmed.startsWith("|") ||
      /^\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+$/.test(trimmed)
    )
      return false;
    if (/^!\[/.test(trimmed) || /^<[^>]+>/.test(trimmed)) return false;
    const links = [...trimmed.matchAll(/\[[^\]]*\]\([^)]*\)/g)];
    const remainder = trimmed
      .replace(/\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/[|·•>/\-\s]/g, "");
    return !(links.length >= 3 && remainder.length < 30);
  });
  const result = lines.join("\n").trim();
  // A truncated JSON envelope is not useful source text.
  if (/^[\[{]/.test(result) && !/^\[[^\]]+\]\(/.test(result)) return "";
  return result;
}
