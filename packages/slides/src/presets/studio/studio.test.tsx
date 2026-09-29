import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { carouselSchema } from "../../content/carousel";
import { exampleCarousel, exampleDatasets, exampleSlides } from "../../content/examples";
import { extremeSlides } from "../../content/extremes";
import { SLIDE_TYPES, type Slide, type SlideType } from "../../content/slides";
import { RenderSlide } from "../../render-slide";
import { parseTheme } from "../registry";
import { LOOK_ART, LOOK_GUIDE, LOOK_IDS, LOOK_NAMES, type LookId } from "./look-ids";
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

describe("generated images", () => {
  const art = { cover: "/media/radev/p/v/art/cover.jpg", cta: "/media/radev/p/v/art/cta.jpg" };
  const draw = (look: LookId, type: "cover" | "cta" | "steps", index: number) =>
    renderToStaticMarkup(
      <RenderSlide
        theme={theme}
        slide={exampleSlides[type]}
        page={{ index, total: 7 }}
        seed="post-1"
        brandName="Marca"
        look={look}
        art={art}
      />,
    );

  it("take the cover and the close of a look that takes them, blended and movable", () => {
    const cover = draw("atmosfera", "cover", 0);
    expect(cover).toContain('src="/media/radev/p/v/art/cover.jpg"');
    expect(cover).toContain("mix-blend-mode:screen");
    expect(cover).toContain('data-layer="hero"');
    expect(draw("gradiente", "cta", 6)).toContain("mix-blend-mode:multiply");
    expect(draw("monocromo", "cover", 0)).toContain("grayscale(1)");
  });

  it("fall back to the brand's element, or use it always when the brand asks", () => {
    const heroId = "0b9f3c2e-4a1d-4c7b-9e2f-1a2b3c4d5e6f";
    const assets = { [heroId]: { url: "/media/lumus/brand/orb.png", width: 512, height: 512 } };
    const withHero = (always: boolean) => {
      const parsedHero = parseTheme("studio", { heroAsset: heroId, heroAlways: always });
      if (!parsedHero.ok) throw new Error(parsedHero.issues.join("\n"));
      return parsedHero.theme;
    };
    const draw = (always: boolean, postArt?: typeof art) =>
      renderToStaticMarkup(
        <RenderSlide
          theme={withHero(always)}
          slide={exampleSlides.cover}
          page={{ index: 0, total: 7 }}
          seed="post-1"
          brandName="Lumus"
          look="atmosfera"
          assets={assets}
          art={postArt}
        />,
      );
    // No generated image: the orb, drawn as it is (no blend).
    expect(draw(false)).toContain('src="/media/lumus/brand/orb.png"');
    expect(draw(false)).not.toContain("mix-blend-mode:screen");
    // A generated one wins, unless the brand always uses its element.
    expect(draw(false, art)).toContain("/art/cover.jpg");
    expect(draw(true, art)).toContain("orb.png");
    expect(draw(true, art)).not.toContain("/art/cover.jpg");
  });

  it("stay out of the other slides and of the looks that take none", () => {
    expect(draw("atmosfera", "steps", 2)).not.toContain("/art/");
    expect(draw("recibo", "cover", 0)).not.toContain("/art/");
  });
});

describe("LOOK_ART", () => {
  it("asks for the background of the surface each slot really has", () => {
    const background = { ink: "dark", paper: "light", accent: undefined } as const;
    for (const [id, art] of Object.entries(LOOK_ART)) {
      const kit = LOOKS[id as LookId];
      for (const total of [5, 6, 8]) {
        expect(background[kit.surface({ index: 0, total, type: "cover" })], `${id} cover`).toBe(
          art?.cover,
        );
        expect(background[kit.surface({ index: total - 1, total, type: "cta" })], `${id} cta`).toBe(
          art?.cta,
        );
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

describe("carousel art", () => {
  const art = {
    cover: "A cracked black ceramic sphere leaking warm light",
    cta: "The same sphere mended with seams of gold",
  };

  it("takes one object for the cover and one for the close", () => {
    expect(carouselSchema.safeParse({ ...exampleCarousel, look: "atmosfera", art }).success).toBe(
      true,
    );
  });

  it("rejects people and things the model would fill with made-up text", () => {
    for (const subject of [
      "A smiling woman holding a phone",
      "A notebook full of handwritten orders",
      "A glowing laptop screen with a dashboard",
      "A neon sign that says open",
    ]) {
      const result = carouselSchema.safeParse({
        ...exampleCarousel,
        art: { ...art, cover: subject },
      });
      expect(result.success, subject).toBe(false);
    }
  });
});

describe("carousel look", () => {
  it("is optional and one of the catalog", () => {
    expect(carouselSchema.safeParse(exampleCarousel).success).toBe(true);
    expect(carouselSchema.safeParse({ ...exampleCarousel, look: "recibo" }).success).toBe(true);
    expect(carouselSchema.safeParse({ ...exampleCarousel, look: "vaporwave" }).success).toBe(false);
  });
});
