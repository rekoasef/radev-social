import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { parseEmphasis } from "./emphasis";
import { exampleSlides, exampleSlidesByPreset } from "./examples";
import { extremeSlides, fillText } from "./extremes";
import { iconName, plainText, richText } from "./fields";
import { SLIDE_TYPES, slideSchema } from "./slides";

function issues(result: { success: boolean; error?: z.ZodError }): string[] {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("text fields", () => {
  it("limits visible characters, not asterisks", () => {
    expect(richText(5).safeParse("*hola*").success).toBe(true);
    expect(issues(richText(5).safeParse("*holas!*"))).toEqual([
      "Tiene 6 caracteres; el máximo es 5.",
    ]);
  });

  it("counts accented characters as one", () => {
    expect(plainText(7).safeParse("Número!").success).toBe(true);
  });

  it("rejects empty texts and broken emphasis", () => {
    expect(issues(richText(10).safeParse("   "))).toEqual(["No puede estar vacío."]);
    expect(issues(richText(10).safeParse("*roto"))).toEqual(["Hay un asterisco sin cerrar."]);
  });

  it("rejects emphasis in plain fields", () => {
    expect(issues(plainText(20).safeParse("*Hola*"))).toEqual([
      "Este campo no admite énfasis (*).",
    ]);
  });

  it("accepts only existing Lucide icons", () => {
    expect(iconName.safeParse("database").success).toBe(true);
    expect(iconName.safeParse("message-circle").success).toBe(true);
    expect(issues(iconName.safeParse("not-an-icon"))).toEqual(["No existe ese ícono en Lucide."]);
    expect(iconName.safeParse("Database").success).toBe(false);
  });
});

describe("slideSchema", () => {
  it("has an example for every slide type", () => {
    expect(Object.keys(exampleSlides).sort()).toEqual([...SLIDE_TYPES].sort());
    expect(SLIDE_TYPES).toHaveLength(12);
  });

  const presetExamples = Object.entries(exampleSlidesByPreset).flatMap(([preset, examples]) =>
    SLIDE_TYPES.map((type) => [preset, type, examples[type]] as const),
  );
  it.each(presetExamples)("accepts the %s %s example", (_, __, slide) => {
    expect(issues(slideSchema.safeParse(slide))).toEqual([]);
  });

  it("rejects an unknown type", () => {
    expect(slideSchema.safeParse({ type: "code", title: "x" }).success).toBe(false);
  });

  it("allows up to two emphasis fragments per slide", () => {
    const slide = { ...exampleSlides.statement, title: "*Uno* y *dos*", body: "Sin énfasis." };
    expect(slideSchema.safeParse(slide).success).toBe(true);
    const tooMany = { ...slide, body: "Y un *tercero*." };
    expect(issues(slideSchema.safeParse(tooMany))).toEqual([
      "Tiene 3 fragmentos con énfasis; el máximo por slide es 2.",
    ]);
  });

  it("enforces item counts", () => {
    const cards = exampleSlides.cardGrid.cards;
    expect(
      slideSchema.safeParse({ ...exampleSlides.cardGrid, cards: cards.slice(0, 2) }).success,
    ).toBe(false);
    const seven = [...cards, cards[0], cards[1]];
    expect(slideSchema.safeParse({ ...exampleSlides.cardGrid, cards: seven }).success).toBe(false);
  });

  it("keeps card, chip and node labels plain", () => {
    const cards = [
      { icon: "link", label: "una *integración*" },
      ...exampleSlides.cardGrid.cards.slice(1),
    ];
    const result = slideSchema.safeParse({ ...exampleSlides.cardGrid, cards });
    expect(issues(result)).toContain("Este campo no admite énfasis (*).");
  });

  it("reports the path of the failing field", () => {
    const nodes = [...exampleSlides.flow.nodes];
    nodes[2] = { icon: "calendar", label: "Una etiqueta demasiado larga" };
    const result = slideSchema.safeParse({ ...exampleSlides.flow, nodes });
    expect(result.error?.issues[0]?.path).toEqual(["nodes", 2, "label"]);
  });
});

const visibleLength = (text: string) => {
  const parsed = parseEmphasis(text);
  return [...(parsed.ok ? parsed.plain : text)].length;
};

describe("extreme examples", () => {
  it.each(SLIDE_TYPES)("the %s worst case is valid", (type) => {
    expect(issues(slideSchema.safeParse(extremeSlides[type]))).toEqual([]);
  });

  it("fills texts to exactly their limit", () => {
    for (const max of [8, 16, 22, 60, 160]) {
      expect(visibleLength(fillText(max)), String(max)).toBe(max);
      expect(visibleLength(fillText(max, 3, { emphasis: true })), String(max)).toBe(max);
    }
    expect(visibleLength(extremeSlides.cover.title)).toBe(60);
    expect(extremeSlides.cardGrid.cards).toHaveLength(6);
  });
});

describe("flow labels", () => {
  it("reject a word too long for the card", () => {
    const nodes = [...exampleSlides.flow.nodes];
    nodes[0] = { icon: "clock", label: "Internacionalización" };
    const result = slideSchema.safeParse({ ...exampleSlides.flow, nodes });
    expect(issues(result).join(" ")).toContain("hasta 16 letras");
    nodes[0] = { icon: "clock", label: "Comercialización" };
    expect(slideSchema.safeParse({ ...exampleSlides.flow, nodes }).success).toBe(true);
  });
});
