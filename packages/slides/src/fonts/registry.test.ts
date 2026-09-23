import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { FONT_FAMILIES, fontStack, fonts, isFontFamily, supportsWeight } from "./registry";

const require = createRequire(import.meta.url);

describe("font registry", () => {
  it.each(FONT_FAMILIES)("%s matches the @font-face rules of its package", (family) => {
    const spec = fonts[family];
    const css = readFileSync(require.resolve(`${spec.package}/index.css`), "utf8");
    expect(css).toContain(`font-family: '${spec.cssFamily}'`);
    expect(css).toContain(`font-weight: ${spec.weights.min} ${spec.weights.max}`);
  });

  it("loads every registered package, and nothing else", () => {
    const load = readFileSync(new URL("./load.ts", import.meta.url), "utf8");
    const imported = [...load.matchAll(/^import "([^"]+)";$/gm)].map((match) => match[1]);
    expect(imported.sort()).toEqual(FONT_FAMILIES.map((family) => fonts[family].package).sort());
  });

  it("recognizes only curated families", () => {
    expect(isFontFamily("Inter Tight")).toBe(true);
    expect(isFontFamily("Geist Sans")).toBe(true);
    expect(isFontFamily("Geist")).toBe(false);
    expect(isFontFamily("Comic Sans MS")).toBe(false);
  });

  it("builds a stack with the package family and a category fallback", () => {
    expect(fontStack("Inter Tight")).toBe('"Inter Tight Variable", system-ui, sans-serif');
    expect(fontStack("Geist Mono")).toBe('"Geist Mono Variable", ui-monospace, monospace');
  });

  it("checks weights against the variable axis", () => {
    expect(supportsWeight("Inter Tight", 900)).toBe(true);
    expect(supportsWeight("Space Grotesk", 900)).toBe(false);
    expect(supportsWeight("Manrope", 100)).toBe(false);
  });
});
