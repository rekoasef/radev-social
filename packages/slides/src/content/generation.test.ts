import { describe, expect, it } from "vitest";
import { exampleCarousel } from "./examples";
import {
  AI_BLOCKED_SLIDES,
  AI_SLIDE_GUIDE,
  aiCarouselSchema,
  describeRenderProblems,
} from "./generation";

describe("aiCarouselSchema", () => {
  const pillar = exampleCarousel.pillarKey;
  const withoutBlocked = {
    ...exampleCarousel,
    slides: exampleCarousel.slides.filter(
      (slide) => !(AI_BLOCKED_SLIDES as readonly string[]).includes(slide.type),
    ),
  };

  it("accepts a carousel with a pillar of the brand", () => {
    const parsed = aiCarouselSchema([pillar, "otro"]).safeParse(withoutBlocked);
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  it("refuses a pillar the brand doesn't have", () => {
    const parsed = aiCarouselSchema(["otro"]).safeParse(withoutBlocked);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["pillarKey"]);
  });

  it("refuses slides whose figures need real data (rule 9)", () => {
    const [cover, ...rest] = withoutBlocked.slides;
    const bigNumber = {
      type: "bigNumber",
      value: "40K",
      label: "reproducciones",
      source: "inventado",
    };
    const parsed = aiCarouselSchema([pillar]).safeParse({
      ...withoutBlocked,
      slides: [cover, bigNumber, ...rest],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.path.join("."))).toContain("slides.1.type");
  });

  it("a post of a series has the slides the series requires", () => {
    const types = withoutBlocked.slides.map((slide) => slide.type);
    const present = types[1] as string;
    expect(
      aiCarouselSchema([pillar], { requiredSlides: [present] }).safeParse(withoutBlocked).success,
    ).toBe(true);

    const missing = (["costBreakdown", "steps", "comparison"] as const).find(
      (type) => !types.includes(type),
    ) as string;
    const parsed = aiCarouselSchema([pillar], { requiredSlides: [present, missing] }).safeParse(
      withoutBlocked,
    );
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["slides"]);
    expect(parsed.error?.issues[0]?.message).toContain(missing);
    expect(parsed.error?.issues[0]?.message).not.toContain(`\`${present}\``);
  });
});

describe("aiCarouselSchema with the pricing document", () => {
  const pillar = exampleCarousel.pillarKey;
  const base = exampleCarousel.slides.filter(
    (slide) =>
      slide.type !== "costBreakdown" &&
      !(AI_BLOCKED_SLIDES as readonly string[]).includes(slide.type),
  );
  const breakdown = {
    type: "costBreakdown",
    title: "¿Cuánto cuesta una web?",
    items: [
      { label: "Diseño", range: "USD 300 – 600" },
      { label: "Desarrollo", range: "USD 500-1.200" },
      { label: "Contenido", range: "a cargo tuyo" },
    ],
    total: { label: "Total", range: "USD 800 – 1.800" },
  };
  // The example's slides with its second one swapped for the breakdown.
  const carousel = { ...exampleCarousel, slides: [base[0], breakdown, ...base.slice(2)] };
  const pricing = `| Web institucional | USD 800 – 1.800 |
Diseño: usd 300-600 · Desarrollo: USD 500 – 1.200 · Contenido: a cargo tuyo`;

  it("accepts ranges written in Precios, whatever the spaces, case or dash", () => {
    const parsed = aiCarouselSchema([pillar], { pricing }).safeParse(carousel);
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  it("refuses a range that is not in Precios (rule 9)", () => {
    const parsed = aiCarouselSchema([pillar], {
      pricing: pricing.replace("1.800", "2.000"),
    }).safeParse(carousel);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "slides.1.total.range",
    ]);
  });

  it("with an empty Precios, no costBreakdown gets through", () => {
    const parsed = aiCarouselSchema([pillar], { pricing: "" }).safeParse(carousel);
    expect(parsed.error?.issues).toHaveLength(4);
  });

  it("without the option, ranges are not checked (the editor's carousels)", () => {
    expect(aiCarouselSchema([pillar]).safeParse(carousel).success).toBe(true);
  });
});

describe("AI_SLIDE_GUIDE", () => {
  it("tells the model which slides it can't use", () => {
    for (const type of AI_BLOCKED_SLIDES) expect(AI_SLIDE_GUIDE).toContain(`\`${type}\``);
  });
});

describe("describeRenderProblems", () => {
  it("describes each QA problem with its slide, once", () => {
    expect(
      describeRenderProblems([
        { slide: 1, kind: "overflow", text: "Un título largo" },
        { slide: 1, kind: "overflow", text: "Un título largo" },
        { slide: 3, kind: "tiktok", text: "Escribime" },
      ]),
    ).toEqual([
      "Slide 2: El texto no entra en su caja: “Un título largo”",
      "Slide 4: Queda debajo de los botones de TikTok: “Escribime”",
    ]);
  });

  it("leaves out render errors, which are not the content's fault", () => {
    expect(describeRenderProblems([{ slide: -1, kind: "error", text: "Timeout" }])).toEqual([]);
  });
});
