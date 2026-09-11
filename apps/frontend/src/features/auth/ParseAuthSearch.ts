import { defaultParseSearch } from "@tanstack/react-router";

export function parseAuthSearch(search: string): Record<string, unknown> {
  const parsed: Record<string, unknown> = defaultParseSearch(search);
  // OAuth codes are opaque strings, including numeric-looking codes. The
  // default JSON parser would coerce those to numbers and lose leading zeros.
  const code = new URLSearchParams(search).get("code");
  if (code !== null) parsed.code = code;
  return parsed;
}
