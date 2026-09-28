import { describe, expect, it } from "vitest";
import { type Carousel, carouselSchema } from "./carousel";
import { exampleCarousel, exampleSlides } from "./examples";
import { SLIDE_TYPES } from "./slides";
import { applyTextEdits, parseHashtags, postTexts, slideTexts } from "./text-fields";

const withSlides = (...middle: Carousel["slides"]): Carousel => ({
  ...exampleCarousel,
  slides: [exampleSlides.cover, ...middle, exampleSlides.cta],
});

/** Every slide type once, cover first and cta last (more slides than a post takes: texts only). */
const everyType = withSlides(
  ...SLIDE_TYPES.filter((t) => t !== "cover" && t !== "cta").map((t) => exampleSlides[t]),
);

describe("slideTexts", () => {
  it("lists every text of every slide type, with editor labels", () => {
    const slides = slideTexts(everyType);
    expect(slides).toHaveLength(everyType.slides.length);
    for (const slide of slides) expect(slide.fields.length).toBeGreaterThan(0);
    const cards = slides[everyType.slides.findIndex((s) => s.type === "cardGrid")];
    expect(cards?.label).toMatch(/Tarjetas/);
    expect(cards?.fields.map((f) => f.label)).toContain("Tarjeta 2 · Etiqueta");
    const comparison = slides.find((s) => s.label.includes("Comparación"));
    expect(comparison?.fields.some((f) => /Opción A .* · Punto 1/.test(f.label))).toBe(true);
  });

  it("never offers types, icons, data or layout", () => {
    const paths = slideTexts(everyType).flatMap((s) => s.fields.map((f) => f.path));
    for (const path of paths) expect(path).not.toMatch(/\.(type|icon|datasetRef|kind|layout)\b/);
  });

  it("leaves out optional texts the slide does not have", () => {
    const { subtitle: _, ...cover } = exampleSlides.cover;
    const [first] = slideTexts(withSlides(exampleSlides.statement));
    const [bare] = slideTexts({ ...exampleCarousel, slides: [cover, exampleSlides.cta] });
    expect(first?.fields.map((f) => f.path)).toContain("slides.0.subtitle");
    expect(bare?.fields.map((f) => f.path)).not.toContain("slides.0.subtitle");
  });
});

describe("applyTextEdits", () => {
  it("changes only the edited texts, and the result is still a valid carousel", () => {
    const result = applyTextEdits(exampleCarousel, {
      texts: {
        hook: "Un título nuevo",
        "slides.0.title": "Otra *portada*",
        "slides.3.cards.1.label": "tablero",
      },
      hashtags: "#pymes procesos, apps",
    });
    expect(result.ok && result.changed).toBe(true);
    if (!result.ok) return;
    const parsed = carouselSchema.parse(result.content);
    expect(parsed.hook).toBe("Un título nuevo");
    expect(parsed.slides[0]).toMatchObject({ type: "cover", title: "Otra *portada*" });
    expect(parsed.hashtags).toEqual(["pymes", "procesos", "apps"]);
    expect(parsed.slides.slice(1)).toEqual(
      exampleCarousel.slides.slice(1).map((slide, i) =>
        i === 2 && slide.type === "cardGrid"
          ? {
              ...slide,
              cards: slide.cards.map((c, j) => (j === 1 ? { ...c, label: "tablero" } : c)),
            }
          : slide,
      ),
    );
    // The original is untouched.
    expect(exampleCarousel.hook).toMatch(/app gigante/);
  });

  it("reports no change when the texts are the same", () => {
    const texts = Object.fromEntries(postTexts(exampleCarousel).map((f) => [f.path, f.value]));
    const result = applyTextEdits(exampleCarousel, {
      texts,
      hashtags: exampleCarousel.hashtags.map((t) => `#${t}`).join(" "),
    });
    expect(result).toEqual({ ok: true, content: exampleCarousel, changed: false });
  });

  it("refuses anything that is not an offered text", () => {
    for (const path of ["slides.0.type", "slides.1.center.icon", "pillarKey", "slides.9.title"]) {
      expect(applyTextEdits(exampleCarousel, { texts: { [path]: "x" } }).ok).toBe(false);
    }
  });

  it("lets the schema catch texts over the limit", () => {
    const result = applyTextEdits(exampleCarousel, {
      texts: { "slides.0.title": "x".repeat(500) },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(carouselSchema.safeParse(result.content).success).toBe(false);
  });
});

describe("parseHashtags", () => {
  it("takes #, spaces and commas", () => {
    expect(parseHashtags("  #uno dos,#tres ,, ##cuatro ")).toEqual([
      "uno",
      "dos",
      "tres",
      "cuatro",
    ]);
    expect(parseHashtags("")).toEqual([]);
  });
});
