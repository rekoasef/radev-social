import { describe, expect, it } from "vitest";
import { exampleCarousel } from "./examples";
import {
  aiCarouselSchema,
  aiSlideGuide,
  aiSlideRewriteSchema,
  brandLooks,
  brandMakesArt,
  DATA_SLIDES,
  describeRenderProblems,
  lookChoices,
} from "./generation";

describe("aiCarouselSchema", () => {
  const pillar = exampleCarousel.pillarKey;
  const withoutBlocked = {
    ...exampleCarousel,
    slides: exampleCarousel.slides.filter(
      (slide) => !(DATA_SLIDES as readonly string[]).includes(slide.type),
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
});

describe("aiCarouselSchema with the pricing document", () => {
  const pillar = exampleCarousel.pillarKey;
  const base = exampleCarousel.slides.filter(
    (slide) =>
      slide.type !== "costBreakdown" && !(DATA_SLIDES as readonly string[]).includes(slide.type),
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

describe("aiCarouselSchema with the brand's data", () => {
  const pillar = exampleCarousel.pillarKey;
  const [cover, ...rest] = exampleCarousel.slides.filter(
    (slide) => !(DATA_SLIDES as readonly string[]).includes(slide.type),
  );
  const data = {
    datasets: ["usd-blue-30d"],
    isFigure: (value: string) => value === "$ 1.560",
  };
  const withSlides = (...slides: unknown[]) => ({
    ...exampleCarousel,
    slides: [cover, ...slides, ...rest],
  });
  const bigNumber = (value: string) => ({
    type: "bigNumber",
    value,
    label: "pesos por dólar blue",
    source: "Bluelytics, 25/09/2026",
  });
  const chart = (datasetRef: string) => ({
    type: "chart",
    title: "Cómo se movió el dólar",
    kind: "line",
    datasetRef,
    source: "Bluelytics, 25/09/2026",
  });

  it("accepts a figure and a dataset of data.json", () => {
    const parsed = aiCarouselSchema([pillar], { data }).safeParse(
      withSlides(bigNumber("$ 1.560"), chart("usd-blue-30d")),
    );
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  it("refuses a figure or a dataset that are not in data.json (rule 9)", () => {
    const parsed = aiCarouselSchema([pillar], { data }).safeParse(
      withSlides(bigNumber("$ 1.600"), chart("usd-euro-30d")),
    );
    expect(parsed.error?.issues.map((issue) => issue.path)).toEqual([
      ["slides", 1, "value"],
      ["slides", 2, "datasetRef"],
    ]);
  });
});

describe("aiCarouselSchema with looks (studio)", () => {
  const pillars = [exampleCarousel.pillarKey];
  const schema = aiCarouselSchema(pillars, { looks: ["chat", "terminal"] });

  it("takes one of the allowed looks", () => {
    expect(schema.safeParse({ ...exampleCarousel, look: "chat" }).success).toBe(true);
  });

  it("rejects a missing look or one the post may not take, saying which ones it can", () => {
    for (const carousel of [exampleCarousel, { ...exampleCarousel, look: "recibo" }]) {
      const result = schema.safeParse(carousel);
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((i) => i.message).join(" ")).toContain("chat, terminal");
    }
  });

  it("asks for the images when the look takes them", () => {
    const withArt = aiCarouselSchema(pillars, { looks: ["atmosfera", "chat"] });
    const result = withArt.safeParse({ ...exampleCarousel, look: "atmosfera" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["art"]);
    const art = {
      cover: "A cracked black ceramic sphere",
      cta: "The same sphere mended with gold",
    };
    expect(withArt.safeParse({ ...exampleCarousel, look: "atmosfera", art }).success).toBe(true);
    expect(withArt.safeParse({ ...exampleCarousel, look: "chat" }).success).toBe(true);
  });

  it("does not ask for a look for other presets", () => {
    expect(aiCarouselSchema(pillars).safeParse(exampleCarousel).success).toBe(true);
  });
});

describe("lookChoices", () => {
  const enabled = ["editorial", "bloques", "chat", "recibo"] as const;

  it("leaves out the looks of the last two posts", () => {
    expect(lookChoices(enabled, ["chat", "recibo", "editorial"])).toEqual(["editorial", "bloques"]);
    expect(lookChoices(enabled, [null, "chat"])).toEqual(["editorial", "bloques", "recibo"]);
  });

  it("never leaves the post without looks", () => {
    expect(lookChoices(["chat"], ["chat", "chat"])).toEqual(["chat"]);
  });
});

describe("aiSlideRewriteSchema", () => {
  const carousel = exampleCarousel;
  const pillars = [exampleCarousel.pillarKey];
  const question = {
    type: "question" as const,
    title: "¿Y si tu cliente te escribe a las 3 de la mañana?",
    callout: { icon: "message-circle", lead: "Te pierde", text: "si nadie contesta a tiempo." },
  };

  it("takes a slide that fits the carousel, even of another type", () => {
    const schema = aiSlideRewriteSchema(carousel, 1, [pillars]);
    expect(schema.safeParse({ slide: question }).success).toBe(true);
  });

  it("keeps the cover and the close in their place", () => {
    const schema = aiSlideRewriteSchema(carousel, 0, [pillars]);
    const result = schema.safeParse({ slide: question });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message).join(" ")).toContain("cover");
  });

  it("reports the carousel's rules as the slide's own (prices, limits)", () => {
    const schema = aiSlideRewriteSchema(carousel, 1, [
      pillars,
      { pricing: "Hosting: USD 10–20/mes" },
    ]);
    const costs = {
      type: "costBreakdown" as const,
      title: "Lo que cuesta",
      items: [
        { label: "Hosting", range: "USD 10–20/mes" },
        { label: "Dominio", range: "USD 999/año" },
        { label: "Mails", range: "USD 10–20/mes" },
      ],
      total: { label: "Total", range: "USD 10–20/mes" },
    };
    const result = schema.safeParse({ slide: costs });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["slide", "items", 1, "range"]);
  });
});

describe("brandMakesArt", () => {
  const heroAsset = "0b9f3c2e-4a1d-4c7b-9e2f-1a2b3c4d5e6f";

  it("is off for a brand that always uses its own element, and for other presets", () => {
    expect(brandMakesArt("studio", {})).toBe(true);
    expect(brandMakesArt("studio", { heroAsset, heroAlways: false })).toBe(true);
    expect(brandMakesArt("studio", { heroAsset, heroAlways: true })).toBe(false);
    // Asking for it with no element set changes nothing.
    expect(brandMakesArt("studio", { heroAlways: true })).toBe(true);
    expect(brandMakesArt("soft", {})).toBe(false);
  });

  it("drops the image section of the guide and the requirement", () => {
    expect(aiSlideGuide({ data: false, looks: ["atmosfera"] })).toContain("## Imagen");
    expect(aiSlideGuide({ data: false, looks: ["atmosfera"], art: false })).not.toContain(
      "## Imagen",
    );
    const schema = aiCarouselSchema([exampleCarousel.pillarKey], {
      looks: ["atmosfera"],
      art: false,
    });
    expect(schema.safeParse({ ...exampleCarousel, look: "atmosfera" }).success).toBe(true);
  });
});

describe("brandLooks", () => {
  it("lists the looks a studio brand has on, and none for other presets", () => {
    expect(brandLooks("studio", { looks: { chat: false } })).not.toContain("chat");
    expect(brandLooks("studio", {}).length).toBe(16);
    expect(brandLooks("bold", {})).toEqual([]);
  });
});

describe("aiCarouselSchema with screenshots (ADR 0024)", () => {
  const pillar = exampleCarousel.pillarKey;
  const phone = {
    id: "00000000-0000-4000-8000-0000000000b1",
    note: "cargar un gasto",
    device: "phone" as const,
  };
  const laptop = {
    id: "00000000-0000-4000-8000-0000000000b2",
    note: "el informe",
    device: "laptop" as const,
  };
  const phone2 = { ...phone, id: "00000000-0000-4000-8000-0000000000b3" };
  const base = exampleCarousel.slides.filter(
    (slide) => !(DATA_SLIDES as readonly string[]).includes(slide.type),
  );
  const withScreen = (screens: string[]) => ({
    ...exampleCarousel,
    slides: [...base.slice(0, -1), { type: "screen", title: "Así se carga", screens }, base.at(-1)],
  });
  const issues = (carousel: unknown, screenshots = [phone, laptop, phone2]) => {
    const parsed = aiCarouselSchema([pillar], { screenshots }).safeParse(carousel);
    return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
  };

  it("takes a screen slide with the post's screenshots, alone or a phone with a laptop", () => {
    expect(issues(withScreen([phone.id]))).toEqual([]);
    expect(issues(withScreen([laptop.id, phone.id]))).toEqual([]);
  });

  it("asks for at least one screen slide when the post has screenshots", () => {
    expect(issues({ ...exampleCarousel, slides: base })).toEqual([
      expect.stringMatching(/al menos una/),
    ]);
  });

  it("refuses screenshots that are not the post's", () => {
    expect(issues(withScreen(["00000000-0000-4000-8000-0000000000ff"]))).toEqual([
      expect.stringMatching(/no es una captura de este post/),
    ]);
  });

  it("refuses two screenshots of the same device together", () => {
    expect(issues(withScreen([phone.id, phone2.id]))).toEqual([
      expect.stringMatching(/una `phone` y una `laptop`/),
    ]);
  });

  it("refuses screen slides in a post without screenshots", () => {
    expect(issues(withScreen([phone.id]), [])).toEqual([
      expect.stringMatching(/no tiene capturas/),
    ]);
  });
});

describe("aiSlideGuide", () => {
  it("explains the screenshots only to a post that has them", () => {
    const shots = [{ id: "a", note: "cargar un gasto", device: "phone" as const }];
    const withShots = aiSlideGuide({ data: false, screenshots: shots });
    expect(withShots).toContain("## Capturas (`screenshots.json`)");
    expect(withShots).toMatch(/- `screen`: una o dos capturas/);
    const without = aiSlideGuide({ data: false });
    expect(without).not.toContain("## Capturas");
    expect(without).toMatch(/- `screen`: .*no la uses/);
  });

  it("tells a brand without data which slides it can't use", () => {
    const guide = aiSlideGuide({ data: false });
    expect(guide).toContain("No uses `chart` ni `bigNumber`");
    expect(guide).not.toContain("data.json");
    expect(guide).not.toContain("{{data}}");
  });

  it("explains data.json to a brand with data", () => {
    const guide = aiSlideGuide({ data: true });
    expect(guide).not.toContain("No uses");
    expect(guide).toContain("## Datos (`data.json`)");
    expect(guide).toMatch(/cta.*\n- `bigNumber`/);
    expect(guide).toMatch(/carruseles\.\n\n## Énfasis/);
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
