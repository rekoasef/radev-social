import { describe, expect, it } from "vitest";
import { getTokenValue, setTokenValue, tokenFormSpec } from "./form-spec";
import { checkTheme, defaultTokens, STYLE_PRESETS, switchPresetTokens } from "./registry";

describe("tokenFormSpec", () => {
  it("groups bold's tokens by their schema titles", () => {
    const groups = tokenFormSpec("bold");
    expect(groups.map((g) => g.title)).toEqual([
      "Colores",
      "Brillo",
      "Tipografías",
      "Esquinas",
      "Encabezado",
      "Pie",
      "Wordmark",
      "Archivos y fondo",
    ]);
    const colors = groups[0]?.fields ?? [];
    expect(colors[0]).toEqual({ path: ["colors", "bg"], title: "Fondo", widget: "color" });
  });

  it("describes every widget with what its control needs", () => {
    const fields = STYLE_PRESETS.flatMap((p) => tokenFormSpec(p).flatMap((g) => g.fields));
    const byTitle = (title: string) => fields.find((f) => f.title === title);
    expect(byTitle("Intensidad del brillo")).toMatchObject({
      widget: "range",
      min: 0,
      max: 0.5,
      step: 0.05,
    });
    expect(byTitle("Tagline")).toMatchObject({ widget: "lines", count: 2, max: 32 });
    expect(byTitle("Punto de acento")).toMatchObject({ widget: "toggle" });
    expect(byTitle("Elemento protagonista")).toMatchObject({ widget: "asset", role: "hero" });
    expect(byTitle("Glows del fondo")).toMatchObject({ widget: "glows", max: 3 });
    const font = byTitle("Títulos");
    expect(font?.widget).toBe("font");
    if (font?.widget === "font") {
      const space = font.families.find((f) => f.family === "Space Grotesk");
      expect(space?.weights).toEqual([300, 400, 500, 600, 700]);
    }
  });

  it.each(STYLE_PRESETS)(
    "covers every token of %s, and each path exists in the defaults",
    (preset) => {
      const paths = tokenFormSpec(preset).flatMap((g) => g.fields.map((f) => f.path));
      const defaults = defaultTokens(preset);
      for (const path of paths)
        expect(getTokenValue(defaults, path), path.join(".")).not.toBeUndefined();
      // Every leaf of the defaults has a field (arrays and fonts count as one field).
      const leaves = (value: unknown, path: string[]): string[] =>
        value !== null && typeof value === "object" && !Array.isArray(value) && !("family" in value)
          ? Object.entries(value).flatMap(([k, v]) => leaves(v, [...path, k]))
          : [path.join(".")];
      expect(paths.map((p) => p.join(".")).sort()).toEqual(leaves(defaults, []).sort());
    },
  );
});

describe("token values", () => {
  it("reads and writes nested paths without mutating", () => {
    const tokens = { colors: { bg: "#000", text: "#fff" }, other: 1 };
    const next = setTokenValue(tokens, ["colors", "bg"], "#111");
    expect(getTokenValue(next, ["colors", "bg"])).toBe("#111");
    expect(next.colors.text).toBe("#fff");
    expect(tokens.colors.bg).toBe("#000");
    expect(next.other).toBe(1);
  });
});

describe("checkTheme", () => {
  it("keys problems by token path", () => {
    const result = checkTheme("bold", {
      colors: { accent: "naranja" },
      header: { left: "x".repeat(41) },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fields).sort()).toEqual(["colors.accent", "header.left"]);
    }
  });

  it("returns complete tokens when valid", () => {
    const result = checkTheme("soft", {});
    expect(result.ok && result.theme.tokens).toEqual(defaultTokens("soft"));
  });
});

describe("switchPresetTokens", () => {
  it("starts from the new preset's defaults and keeps shared assets", () => {
    const logo = "0b9f3c2e-4a1d-4c7b-9e2f-1a2b3c4d5e6f";
    const bold = { ...defaultTokens("bold"), logoAsset: logo };
    const soft = switchPresetTokens("soft", bold);
    expect(soft).toEqual({ ...defaultTokens("soft"), logoAsset: logo });
  });
});
