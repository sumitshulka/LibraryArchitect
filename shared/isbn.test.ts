import { describe, expect, it } from "vitest";
import { normalizeIsbn } from "./isbn";

describe("normalizeIsbn", () => {
  it("removes separators and uppercases ISBN-10 check digits", () => {
    expect(normalizeIsbn("978-0-13-235088-4")).toBe("9780132350884");
    expect(normalizeIsbn("0-8044-2957-x")).toBe("080442957X");
  });

  it("removes non-ISBN formatting before uniqueness checks", () => {
    expect(normalizeIsbn("978.0/13 235088 4")).toBe("9780132350884");
  });
});