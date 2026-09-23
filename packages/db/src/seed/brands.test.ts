import { parseTheme } from "@radev/slides";
import { describe, expect, it } from "vitest";
import { seedBrands } from "./brands";

describe("seed brands", () => {
  it.each(seedBrands.map((brand) => [brand.slug, brand] as const))(
    "%s has tokens that match its preset exactly",
    (_, brand) => {
      const result = parseTheme(brand.stylePreset, brand.themeTokens);
      expect(result.ok ? [] : result.issues).toEqual([]);
      // No field left to defaults: the seed spells out every brand value.
      expect(result.ok && result.theme.tokens).toEqual(brand.themeTokens);
    },
  );
});
