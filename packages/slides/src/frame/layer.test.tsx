import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { exampleDatasets, exampleSlidesByPreset } from "../content/examples";
import { SLIDE_TYPES, type Slide } from "../content/slides";
import { type BrandTheme, defaultTokens, parseTheme, STYLE_PRESETS } from "../presets/registry";
import { RenderSlide } from "../render-slide";
import { hasTemplate } from "../slide-content";
import type { SlideAssets } from "./types";

const heroId = "0b9f3c2e-4a1d-4c7b-9e2f-1a2b3c4d5e6f";
const assets: SlideAssets = { [heroId]: { url: "/media/orb.png", width: 512, height: 512 } };

function theme(preset: (typeof STYLE_PRESETS)[number]): BrandTheme {
  const parsed = parseTheme(preset, { ...defaultTokens(preset), heroAsset: heroId });
  if (!parsed.ok) throw new Error(parsed.issues.join("\n"));
  return parsed.theme;
}

const render = (t: BrandTheme, slide: Slide) =>
  renderToStaticMarkup(
    <RenderSlide
      theme={t}
      slide={slide}
      page={{ index: 2, total: 7 }}
      seed="post-1"
      brandName="Marca"
      datasets={exampleDatasets}
      assets={assets}
    />,
  );

describe("movable layers (ADR 0013)", () => {
  for (const preset of STYLE_PRESETS) {
    const t = theme(preset);
    const examples = exampleSlidesByPreset[preset];
    const types = SLIDE_TYPES.filter((type) => hasTemplate(preset, type));

    it(`${preset}: every template has a title and a body layer`, () => {
      for (const type of types) {
        const html = render(t, examples[type]);
        expect(html, type).toContain('data-layer="title"');
        expect(html, type).toContain('data-layer="body"');
      }
    });

    it(`${preset}: a slide without adjustments draws nothing moved`, () => {
      for (const type of types) {
        const slide = examples[type];
        const html = render(t, slide);
        expect(html, type).not.toContain("data-moved");
        expect(html, type).not.toContain("--title-adjust:");
        // Adjustments at zero are the same as none.
        expect(render(t, { ...slide, layout: { title: { x: 0, y: 0 } } }), type).toBe(html);
      }
    });

    it(`${preset}: moves and resizes the layers it is told to`, () => {
      const cover = { ...examples.cover, layout: { title: { x: 0, y: 120, scale: 1.2 } } };
      const html = render(t, cover);
      expect(html).toContain("translate(0px, 120px)");
      expect(html).toContain("--title-adjust:1.2");
      expect(html.match(/data-moved/g)).toHaveLength(1);
    });
  }

  it("soft: the hero moves and scales around its own centering", () => {
    const cover = {
      ...exampleSlidesByPreset.soft.cover,
      layout: { hero: { x: -40, y: 60, scale: 1.5 } },
    };
    const html = render(theme("soft"), cover);
    expect(html).toContain('data-layer="hero"');
    expect(html).toMatch(/transform:translate\(-40px, 60px\) translateX\([\d.]+px\) scale\(1\.5\)/);
  });
});
