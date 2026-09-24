import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { exampleDatasets, exampleSlidesByPreset } from "../../../content/examples";
import { SLIDE_TYPES, type Slide } from "../../../content/slides";
import { SlideFrame } from "../../../frame/slide-frame";
import type { SlideAssets } from "../../../frame/types";
import { hasTemplate, SlideContent } from "../../../slide-content";
import { type BrandTheme, defaultTokens, parseTheme } from "../../registry";
import { titleSize } from "../parts";
import { bigNumberSize } from "./big-number";
import { coverTitleSize } from "./cover";

const examples = exampleSlidesByPreset.soft;
const heroId = "0b9f3c2e-4a1d-4c7b-9e2f-1a2b3c4d5e6f";
const assets: SlideAssets = {
  [heroId]: { url: "/media/x/brand/orb.png", width: 512, height: 512 },
};

function theme(tokens: object = {}): BrandTheme {
  const parsed = parseTheme("soft", { ...defaultTokens("soft"), ...tokens });
  if (!parsed.ok) throw new Error(parsed.issues.join("\n"));
  return parsed.theme;
}
const plain = theme();
const withHero = theme({ heroAsset: heroId });

const render = (slide: Slide, t: BrandTheme = plain, a: SlideAssets = {}) =>
  renderToStaticMarkup(
    <SlideContent theme={t} slide={slide} datasets={exampleDatasets} assets={a} />,
  );

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("soft templates", () => {
  it("exist for every slide type", () => {
    for (const type of SLIDE_TYPES) expect(hasTemplate("soft", type), type).toBe(true);
  });

  it("render every example without emphasis marks, marked for the render QA", () => {
    for (const type of SLIDE_TYPES) {
      const html = render(examples[type]);
      expect(html, type).toContain('data-qa="text"');
      expect(html, type).toContain('data-qa="content"');
      expect(html, type).not.toMatch(/\*[^\s)]/);
    }
  });

  it("show the hero asset on cover and cta, and go without it when it is not set", () => {
    for (const type of ["cover", "cta"] as const) {
      expect(render(examples[type], withHero, assets), type).toContain("/media/x/brand/orb.png");
      expect(render(examples[type]), type).not.toContain("<img");
      // A token pointing to a file that is gone: no image, no crash.
      expect(render(examples[type], withHero, {}), type).not.toContain("<img");
    }
  });

  it("never show the hero asset on data slides", () => {
    for (const type of ["bigNumber", "chart", "costBreakdown", "comparison"] as const) {
      expect(render(examples[type], withHero, assets), type).not.toContain("<img");
    }
  });

  it("emphasis is color only, and short title emphasis stays on one line", () => {
    const html = render(examples.cta);
    expect(html).toContain("color:var(--accent);white-space:nowrap");
    expect(html).not.toContain("text-transform:uppercase");
  });

  it("comparison favors the right column", () => {
    const html = render(examples.comparison);
    expect(html.indexOf("Planilla")).toBeLessThan(html.indexOf("App de gastos"));
    expect(count(html, "color-mix(in srgb, var(--accent) 45%, transparent)")).toBe(1);
  });

  it("flow and hubDiagram draw their connectors", () => {
    expect(count(render(examples.flow), "<polyline")).toBe(examples.flow.nodes.length - 1);
    expect(count(render(examples.hubDiagram), 'marker-end="url(#soft-hub-arrow)"')).toBe(
      examples.hubDiagram.nodes.length,
    );
  });

  it("chart fails without its dataset instead of drawing made-up numbers", () => {
    expect(() =>
      renderToStaticMarkup(<SlideContent theme={plain} slide={examples.chart} />),
    ).toThrow(/usd-blue-30d/);
  });

  it("sizes titles and big numbers by length", () => {
    expect(coverTitleSize("Corto")).toBeGreaterThan(titleSize("Corto"));
    expect(titleSize("Corto")).toBeGreaterThan(
      titleSize("Información organización presupuesto mantenimiento comunicac"),
    );
    expect(bigNumberSize("12")).toBe(220);
    expect(bigNumberSize("USD 1.250.000")).toBeLessThan(120);
  });
});

describe("soft frame", () => {
  const frame = (index: number) =>
    renderToStaticMarkup(
      <SlideFrame
        theme={theme({ wordmark: { text: "LUMUS" }, footer: { url: "ejemplo.com" } })}
        brandName="Marca"
        page={{ index, total: 7 }}
        seed="s"
      />,
    );

  it("shows the wordmark, the site and the page", () => {
    const html = frame(2);
    expect(html).toContain("LUMUS");
    expect(html).toContain("ejemplo.com");
    expect(html).toContain(">03</span> / 07");
  });

  it("invites to swipe on the cover", () => {
    expect(frame(0)).toContain("Deslizá →");
  });

  it("falls back to the brand name without a wordmark text", () => {
    const html = renderToStaticMarkup(
      <SlideFrame theme={plain} brandName="Marca" page={{ index: 1, total: 5 }} seed="s" />,
    );
    expect(html).toContain("Marca");
  });
});
