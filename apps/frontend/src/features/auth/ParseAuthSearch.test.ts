import { describe, expect, it } from "vitest";
import { parseAuthSearch } from "./ParseAuthSearch";

describe("OAuth callback search parsing", () => {
  it("preserves numeric codes and leading zeros", () => {
    expect(parseAuthSearch("?code=000123&authReturn=true")).toEqual({
      code: "000123",
      authReturn: true,
    });
  });

  it("decodes opaque codes once without JSON coercion", () => {
    expect(parseAuthSearch("?code=false%2B%252F").code).toBe("false+%2F");
    expect(parseAuthSearch("?code=false").code).toBe("false");
  });

  it("retains normal TanStack parsing for other search state", () => {
    expect(parseAuthSearch("?page=2&filters=%5B%22open%22%5D")).toEqual({
      page: 2,
      filters: ["open"],
    });
  });
});
