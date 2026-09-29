import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { carouselSchema } from "../../content/carousel";
import { exampleCarousel, exampleDatasets, exampleSlides } from "../../content/examples";
import { extremeSlides } from "../../content/extremes";
import { SLIDE_TYPES, type Slide, type SlideType } from "../../content/slides";
import { RenderSlide } from "../../render-slide";
import { parseTheme } from "../registry";
import { LOOK_GUIDE, LOOK_IDS, LOOK_NAMES, type LookId } from "./look-ids";
import { LOOKS, resolveLook } from "./looks";
import { enabledLooks, studioTokensSchema } from "./tokens";

const parsed = parseTheme("studio", {});
if (!parsed.ok) throw new Error(parsed.issues.join("\n"));
const theme = parsed.theme;

const render = (slide: Slide, look: LookId, index = 2) =>
  renderToStaticMarkup(
    <RenderSlide
      theme={theme}
      slide={slide}
      page={{ index, total: 7 }}
      seed="post-1"
      brandName="Marca"
      datasets={exampleDatasets}
      look={look}
    />,
  );

const indexOf = (type: SlideType) => (type === "cover" ? 0 : type === "cta" ? 6 : 2);

describe("studio looks", () => {
  it("have a kit, a name and a guide for the AI each", () => {
    for (const id of LOOK_IDS) {
      expect(LOOKS[id].id).toBe(id);
      expect(LOOK_NAMES[id].length).toBeGreaterThan(0);
      expect(LOOK_GUIDE[id].length).toBeGreaterThan(40);
    }
  });

  for (const look of LOOK_IDS) {
    it(`${look}: draws every slide type with its layers and QA marks`, () => {
      for (const type of SLIDE_TYPES) {
        const html = render(exampleSlides[type], look, indexOf(type));
        expect(html, type).toContain(`data-look="${look}"`);
        expect(html, type).toContain("data-slide-frame");
        expect(html, type).toContain('data-layer="title"');
        expect(html, type).toContain('data-layer="body"');
        expect(html, type).toContain('data-qa="content"');
        expect(html, type).toContain('data-qa="text"');
        // Emphasis marks are turned into styles, never shown.
        expect(html, type).not.toMatch(/\*[\p{L}\p{N}]/u);
      }
    });

    it(`${look}: draws the worst-case texts too`, () => {
      for (const type of SLIDE_TYPES) {
        expect(() => render(extremeSlides[type], look, indexOf(type)), type).not.toThrow();
      }
    });
  }

  it("keep the cover and the close on fixed surfaces, and data slides off the accent", () => {
    for (const look of LOOK_IDS) {
      const kit = LOOKS[look];
      for (const total of [5, 6, 7, 8]) {
        expect(kit.surface({ index: 0, total, type: "cover" })).toBe(
          kit.surface({ index: 0, total: 5, type: "cover" }),
        );
        for (let index = 1; index < total - 1; index++) {
          for (const type of ["chart", "bigNumber", "costBreakdown", "comparison"] as const) {
            expect(kit.surface({ index, total, type }), `${look} ${type} ${index}`).not.toBe(
              "accent",
            );
          }
        }
      }
    }
  });
});

describe("resolveLook", () => {
  const enabled: LookId[] = ["editorial", "plano", "chat"];

  it("keeps the post's look while the brand has it on", () => {
    expect(resolveLook("plano", enabled, "post-1")).toBe("plano");
  });

  it("picks one of the brand's looks by the post id otherwise, always the same", () => {
    const picked = resolveLook(undefined, enabled, "post-1");
    expect(enabled).toContain(picked);
    expect(resolveLook(undefined, enabled, "post-1")).toBe(picked);
    expect(enabled).toContain(resolveLook("neon", enabled, "post-1"));
  });

  it("spreads posts across the looks", () => {
    const seen = new Set(
      Array.from({ length: 60 }, (_, i) => resolveLook(undefined, enabled, `post-${i}`)),
    );
    expect(seen.size).toBe(enabled.length);
  });
});

describe("studio tokens", () => {
  it("turn every look on by default", () => {
    expect(enabledLooks(studioTokensSchema.parse({}))).toEqual([...LOOK_IDS]);
  });

  it("need at least one look on", () => {
    const off = Object.fromEntries(LOOK_IDS.map((id) => [id, false]));
    expect(studioTokensSchema.safeParse({ looks: off }).success).toBe(false);
    expect(enabledLooks(studioTokensSchema.parse({ looks: { ...off, chat: true } }))).toEqual([
      "chat",
    ]);
  });
});

describe("carousel look", () => {
  it("is optional and one of the catalog", () => {
    expect(carouselSchema.safeParse(exampleCarousel).success).toBe(true);
    expect(carouselSchema.safeParse({ ...exampleCarousel, look: "recibo" }).success).toBe(true);
    expect(carouselSchema.safeParse({ ...exampleCarousel, look: "vaporwave" }).success).toBe(false);
  });
});
