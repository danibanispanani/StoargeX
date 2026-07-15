import { describe, expect, it } from "vitest";
import { parseHttpUrlList } from "@/lib/url-list";

describe("HTTP URL lists", () => {
  it("normalizes comma and line separated evidence URLs", () => {
    expect(parseHttpUrlList("https://example.com/a,\nhttp://example.org/b")).toEqual([
      "https://example.com/a",
      "http://example.org/b",
    ]);
  });

  it("rejects non-web schemes", () => {
    expect(() => parseHttpUrlList("javascript:alert(1)")).toThrow(/HTTP/);
  });
});
