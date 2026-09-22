export function publicIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return false;
  const [a, b, c] = parts;
  return (
    a > 0 &&
    a < 224 &&
    a !== 10 &&
    a !== 127 &&
    a !== 169 &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && ((b === 0 && (c === 0 || c === 2)) || b === 168)) &&
    !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) &&
    !(a === 203 && b === 0 && c === 113)
  );
}

export function imageType(bytes: Uint8Array): string | null {
  const prefix = (start: number, text: string) =>
    [...text].every(
      (character, index) => bytes[start + index] === character.charCodeAt(0),
    );
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => bytes[index] === byte,
    )
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (bytes.length >= 6 && (prefix(0, "GIF87a") || prefix(0, "GIF89a")))
    return "image/gif";
  if (bytes.length >= 12 && prefix(0, "RIFF") && prefix(8, "WEBP"))
    return "image/webp";
  return null;
}

export function isPageType(mime: string) {
  return ["text/html", "application/xhtml+xml", "text/plain"].includes(mime);
}
