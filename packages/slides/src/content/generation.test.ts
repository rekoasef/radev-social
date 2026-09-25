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
