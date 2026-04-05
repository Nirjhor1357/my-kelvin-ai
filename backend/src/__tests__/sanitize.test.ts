import { sanitizeText } from "../shared/sanitize.js";

describe("sanitizeText", () => {
  it("removes null bytes and trims whitespace", () => {
    expect(sanitizeText("  hello\u0000\n\n\nworld  ", 2000)).toBe("hello\n\nworld");
  });

  it("enforces max length", () => {
    const input = "a".repeat(10);
    expect(sanitizeText(input, 5)).toHaveLength(5);
  });
});
