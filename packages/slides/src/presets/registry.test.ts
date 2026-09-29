import { describe, expect, it } from "vitest";
import { boldTokensSchema } from "./bold/tokens";
import { defaultTokens, isStylePreset, parseTheme, STYLE_PRESETS } from "./registry";
import { softTokensSchema } from "./soft/tokens";

describe("preset registry", () => {
  it("lists bold, soft and studio", () => {
    expect(STYLE_PRESETS).toEqual(["bold", "soft", "studio"]);
    expect(isStylePreset("bold")).toBe(true);
    expect(isStylePreset("toString")).toBe(false);
  });

  it.each(STYLE_PRESETS)("builds complete default tokens for %s", (preset) => {
    const tokens = defaultTokens(preset);
    expect(parseTheme(preset, tokens)).toEqual({ ok: true, theme: { preset, tokens } });
    expect(parseTheme(preset, {})).toEqual({ ok: true, theme: { preset, tokens } });
  });

  it("fills missing fields of a partial theme with defaults", () => {
    const result = parseTheme("bold", { colors: { accent: "#FF7A00" } });
    expect(result.ok && result.theme.tokens.colors).toMatchObject({
      accent: "#FF7A00",
      bg: "#0B0B0B",
    });
  });

  it("rejects an unknown preset", () => {
    expect(parseTheme("neon", {})).toEqual({ ok: false, issues: ['No existe el preset "neon".'] });
  });

  it("reports issues with their path", () => {
    const result = parseTheme("bold", { colors: { accent: "naranja" } });
    expect(result).toEqual({
      ok: false,
      issues: ["colors › accent: Usá un color hex (#FF7A00) o rgba(...)."],
    });
  });
});

describe("token fields", () => {
  it("accepts hex and rgba colors", () => {
    for (const value of [
      "#FFF",
      "#FF7A00",
      "#FF7A0080",
      "rgba(255, 255, 255, 0.08)",
      "rgb(0,0,0)",
    ]) {
      expect(boldTokensSchema.safeParse({ colors: { bg: value } }).success, value).toBe(true);
    }
    for (const value of ["FF7A00", "#FF7A0", "red", "rgba(0,0,0,2)"]) {
      expect(boldTokensSchema.safeParse({ colors: { bg: value } }).success, value).toBe(false);
    }
  });

  it("accepts only curated fonts in weights they support", () => {
    const withDisplay = (display: unknown) => boldTokensSchema.safeParse({ fonts: { display } });
    expect(withDisplay({ family: "Space Grotesk", weight: 700 }).success).toBe(true);
    expect(withDisplay({ family: "Comic Sans MS", weight: 400 }).success).toBe(false);
    const heavy = withDisplay({ family: "Space Grotesk", weight: 900 });
    expect(heavy.error?.issues.map((i) => [i.path, i.message])).toEqual([
      [["fonts", "display", "weight"], "Esa tipografía no tiene ese peso."],
    ]);
  });

  it("bounds ranges", () => {
    expect(boldTokensSchema.safeParse({ glow: { intensity: 0.5 } }).success).toBe(true);
    expect(boldTokensSchema.safeParse({ glow: { intensity: 0.8 } }).success).toBe(false);
    expect(softTokensSchema.safeParse({ wordmark: { tracking: 0.5 } }).success).toBe(false);
  });

  it("limits text lines", () => {
    expect(boldTokensSchema.safeParse({ footer: { tagline: ["UNO", "DOS"] } }).success).toBe(true);
    expect(
      boldTokensSchema.safeParse({ footer: { tagline: ["UNO", "DOS", "TRES"] } }).success,
    ).toBe(false);
  });

  it("references assets by id", () => {
    expect(softTokensSchema.safeParse({ heroAsset: "lumus-orb.png" }).success).toBe(false);
    const id = "0b9a3c1e-6d2f-4f7a-9c4e-2b1d8e5f7a60";
    expect(softTokensSchema.parse({ heroAsset: id }).heroAsset).toBe(id);
  });

  it("carries form metadata", () => {
    expect(boldTokensSchema.shape.colors.meta()).toEqual({ title: "Colores" });
    expect(boldTokensSchema.shape.logoAsset.meta()).toEqual({
      title: "Logo",
      widget: "asset",
      role: "logo",
    });
  });
});
