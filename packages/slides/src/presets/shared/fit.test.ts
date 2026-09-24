import { describe, expect, it } from "vitest";
import { countLines, fitTextSize } from "./fit";

const glyphs = { char: 0.5, space: 0.25 };

describe("countLines", () => {
  it("breaks between words like the browser", () => {
    // At size 10 a letter is 5 px and a space 2.5 px.
    expect(countLines("abcd abcd", 100, 10, glyphs)).toBe(1); // 20 + 2.5 + 20
    expect(countLines("abcd abcd", 40, 10, glyphs)).toBe(2);
    expect(countLines("", 100, 10, glyphs)).toBe(0);
  });

  it("gives a word longer than the line a line of its own", () => {
    expect(countLines("a muylargapalabra b", 40, 10, glyphs)).toBe(3);
  });
});

describe("fitTextSize", () => {
  const sizes = [100, 80, 60];

  it("picks the biggest size that fits the lines", () => {
    expect(fitTextSize("hola", { width: 1000, sizes, maxLines: 1, glyphs })).toBe(100);
    // 16 letters + 1 space: 16 × 0.5 × 100 + 25 = 825 > 700 at 100; 660 at 80.
    expect(fitTextSize("abcdefgh abcdefgh", { width: 700, sizes, maxLines: 1, glyphs })).toBe(80);
  });

  it("falls back to the smallest size when nothing fits", () => {
    expect(fitTextSize("x".repeat(100), { width: 100, sizes, maxLines: 1, glyphs })).toBe(60);
  });
});
