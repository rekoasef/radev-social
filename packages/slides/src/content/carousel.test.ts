import { describe, expect, it } from "vitest";
import { z } from "zod";
import { carouselSchema } from "./carousel";
import { exampleCarousel, exampleCarouselByPreset, exampleSlides } from "./examples";

function messages(value: unknown): string[] {
  return carouselSchema.safeParse(value).error?.issues.map((issue) => issue.message) ?? [];
}

describe("carouselSchema", () => {
  it("accepts the example carousel", () => {
    for (const carousel of Object.values(exampleCarouselByPreset)) {
      expect(messages(carousel)).toEqual([]);
    }
  });

  it("requires 5 to 8 slides", () => {
    const four = [exampleSlides.cover, exampleSlides.flow, exampleSlides.steps, exampleSlides.cta];
    expect(carouselSchema.safeParse({ ...exampleCarousel, slides: four }).success).toBe(false);
    const middle = Array.from({ length: 7 }, () => exampleSlides.steps);
    const nine = [exampleSlides.cover, ...middle, exampleSlides.cta];
    expect(carouselSchema.safeParse({ ...exampleCarousel, slides: nine }).success).toBe(false);
  });

  it("starts with cover and ends with cta, and uses them nowhere else", () => {
    const { cover, cta, flow, steps, statement } = exampleSlides;
    expect(messages({ ...exampleCarousel, slides: [flow, cover, steps, statement, cta] })).toEqual([
      "La primera slide tiene que ser `cover`.",
      "`cover` solo puede ir primera.",
    ]);
    expect(messages({ ...exampleCarousel, slides: [cover, cta, steps, statement, flow] })).toEqual([
      "`cta` solo puede ir última.",
      "La última slide tiene que ser `cta`.",
    ]);
  });

  it("validates hashtags", () => {
    expect(messages({ ...exampleCarousel, hashtags: ["#pymes"] })).toEqual([
      "Sin #, espacios ni signos.",
    ]);
    expect(
      carouselSchema.safeParse({ ...exampleCarousel, hashtags: ["año2026", "ñandú"] }).success,
    ).toBe(true);
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(carouselSchema.safeParse({ ...exampleCarousel, hashtags: six }).success).toBe(false);
  });

  it("requires one alt text per slide when present", () => {
    const altTexts = exampleCarousel.slides.map((_, index) => `Slide ${index + 1}`);
    expect(messages({ ...exampleCarousel, altTexts })).toEqual([]);
    expect(messages({ ...exampleCarousel, altTexts: altTexts.slice(1) })).toEqual([
      "Tiene que haber un texto alternativo por slide (6).",
    ]);
  });

  it("converts to JSON Schema for the AI providers", () => {
    const schema = z.toJSONSchema(carouselSchema, { io: "input" });
    const json = JSON.stringify(schema);
    expect(json).toContain('"hookType"');
    expect(json).toContain("Admite *énfasis*");
    expect(json).toContain('"hubDiagram"');
  });
});

describe("carousel middle image (ADR 0026)", () => {
  const art = {
    cover: "A worn leather wallet stretched to bursting",
    cta: "The same wallet, mended and neatly closed",
  };
  const photo = { ...exampleSlides.statement, composition: "photo" };
  const withSlides = (middle: unknown[]) => ({
    ...exampleCarousel,
    look: "editorial",
    slides: [exampleCarousel.slides[0], ...middle, exampleCarousel.slides.at(-1)],
  });

  it("goes with one statement in `photo`", () => {
    const middle = "A brass hourglass with the sand almost run out";
    const slides = [photo, exampleSlides.steps, exampleSlides.cardGrid];
    expect(messages({ ...withSlides(slides), art: { ...art, middle } })).toEqual([]);
    // Without its slide, or the slide without its image.
    expect(
      messages({
        ...withSlides([exampleSlides.statement, exampleSlides.steps, exampleSlides.cardGrid]),
        art: { ...art, middle },
      }),
    ).toEqual([expect.stringContaining("`photo`")]);
    expect(messages({ ...withSlides(slides), art })).toEqual([
      expect.stringContaining("art.middle"),
    ]);
    // Two photos: one at most.
    expect(
      messages({ ...withSlides([photo, exampleSlides.steps, photo]), art: { ...art, middle } }),
    ).toEqual([expect.stringContaining("Solo una")]);
  });

  it("knows the compositions of each type", () => {
    const cover = { ...exampleSlides.cover, composition: "bleed" };
    expect(
      messages(withSlides([exampleSlides.steps, exampleSlides.cardGrid, exampleSlides.statement])),
    ).toEqual([]);
    expect(
      carouselSchema.safeParse({
        ...withSlides([exampleSlides.steps, exampleSlides.cardGrid, exampleSlides.statement]),
        slides: [cover, ...exampleCarousel.slides.slice(1)],
      }).success,
    ).toBe(true);
    const wrong = { ...exampleSlides.steps, composition: "bento" };
    expect(
      carouselSchema.safeParse(withSlides([wrong, exampleSlides.cardGrid, exampleSlides.statement]))
        .success,
    ).toBe(false);
  });
});
