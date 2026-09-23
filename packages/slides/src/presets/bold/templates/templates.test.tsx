import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { exampleDatasets, exampleSlides } from "../../../content/examples";
import { SLIDE_TYPES, type Slide } from "../../../content/slides";
import { formatNumber } from "../../../format";
import { hasTemplate, SlideContent } from "../../../slide-content";
import { type BrandTheme, defaultTokens, parseTheme } from "../../registry";
import { fitFontSize, titleSize } from "../parts";
import { bigNumberSize } from "./big-number";
import { coverTitleSize } from "./cover";

const parsed = parseTheme("bold", defaultTokens("bold"));
if (!parsed.ok) throw new Error(parsed.issues.join("\n"));
const theme = parsed.theme;

const render = (slide: Slide, t: BrandTheme = theme) =>
  renderToStaticMarkup(<SlideContent theme={t} slide={slide} datasets={exampleDatasets} />);

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("bold templates", () => {
  it("exist for every slide type", () => {
    for (const type of SLIDE_TYPES) expect(hasTemplate("bold", type), type).toBe(true);
    expect(hasTemplate("soft", "cardGrid")).toBe(false);
  });

  it("render every example without emphasis marks", () => {
    for (const type of SLIDE_TYPES) {
      const html = render(exampleSlides[type]);
      expect(html, type).toContain('data-qa="text"');
      expect(html, type).not.toMatch(/\*[^\s)]/);
    }
  });

  it("comparison favors the right column: accent border and markers", () => {
    const html = render(exampleSlides.comparison);
    expect(html).toContain("Sistema propio");
    expect(html).toContain("border:1.5px solid var(--line)");
    expect(html.indexOf("var(--line)")).toBeLessThan(html.indexOf("Sistema propio"));
  });

  it("costBreakdown lists every item and highlights the total", () => {
    const html = render(exampleSlides.costBreakdown);
    for (const item of exampleSlides.costBreakdown.items) expect(html).toContain(item.label);
    expect(html).toContain("USD 00–000");
  });

  it("steps numbers them 01, 02… with a rail between consecutive steps only", () => {
    const html = render(exampleSlides.steps);
    expect(html).toContain(">01<");
    expect(html).toContain(">03<");
    expect(count(html, 'aria-hidden="true" style="position:absolute')).toBe(
      exampleSlides.steps.steps.length - 1,
    );
  });

  it("bigNumber shows value and source, and sizes the value to fit", () => {
    const html = render(exampleSlides.bigNumber);
    expect(html).toContain(">0.000<");
    expect(html).toContain("Fuente: Bluelytics (ejemplo)");
    expect(bigNumberSize("12")).toBe(260);
    expect(bigNumberSize("USD 1.250.000")).toBeLessThan(120);
  });

  it("chart draws the dataset's points with the latest value formatted", () => {
    const html = render(exampleSlides.chart);
    const points = exampleDatasets["usd-blue-30d"]?.points ?? [];
    const lastValue = points[points.length - 1]?.value ?? 0;
    expect(html).toContain(`$ ${formatNumber(lastValue)}`);
    expect(html).toContain("Día 1");
    expect(html).toContain("Día 30");
  });

  it("chart fails without its dataset instead of drawing made-up numbers", () => {
    expect(() =>
      renderToStaticMarkup(<SlideContent theme={theme} slide={exampleSlides.chart} />),
    ).toThrow(/usd-blue-30d/);
  });

  it("cover shows kicker, title and subtitle, with a bigger title for short hooks", () => {
    const html = render(exampleSlides.cover);
    expect(html).toContain("Serie · Costos");
    expect(html).toContain("Programarla no es el único costo.");
    expect(coverTitleSize("Corto")).toBeGreaterThan(titleSize("Corto"));
    expect(render({ type: "cover", title: "Solo título" })).toContain("Solo título");
  });

  it("statement draws the from → to visual only when present", () => {
    const html = render(exampleSlides.statement);
    expect(html).toContain("Desarrollo");
    expect(html).toContain('marker-end="url(#statement-arrow)"');
    const { visual: _, ...plain } = exampleSlides.statement;
    expect(render(plain)).not.toContain("statement-arrow");
  });

  it("question joins lead and text in one paragraph, lead in bold", () => {
    const html = render(exampleSlides.question);
    expect(html).toMatch(/<strong[^>]*>Pensalo así:<\/strong> cada búsqueda/);
  });

  it("cta shows the button and the brand's tagline when it has one", () => {
    const withTagline = parseTheme("bold", {
      ...defaultTokens("bold"),
      footer: { tagline: ["Automatización", "Ideas en resultados"] },
    });
    if (!withTagline.ok) throw new Error("tokens inválidos");
    const html = render(exampleSlides.cta, withTagline.theme);
    expect(html).toContain("Escribime por WhatsApp");
    expect(html).toContain("Ideas en resultados");
    // Default tokens have no tagline: nothing is drawn.
    expect(render(exampleSlides.cta)).not.toContain("Ideas en resultados");
  });

  it("cardGrid renders every card with its lead and label, and the emphasis in accent", () => {
    const html = render(exampleSlides.cardGrid);
    for (const card of exampleSlides.cardGrid.cards) expect(html).toContain(card.label);
    expect(html).toContain(">una</div>");
    expect(html).toContain('<span style="color:var(--accent)">para mejorar esto.</span>');
    // The emphasis marks never reach the output.
    expect(html).not.toContain("*para");
    expect(html).not.toContain("problema.*");
  });

  it("flow draws one connector between consecutive nodes", () => {
    const html = render(exampleSlides.flow);
    for (const node of exampleSlides.flow.nodes) expect(html).toContain(node.label);
    expect(count(html, "<polyline")).toBe(exampleSlides.flow.nodes.length - 1);
  });

  it("hubDiagram draws one arrow per node into the center", () => {
    const html = render(exampleSlides.hubDiagram);
    for (const node of exampleSlides.hubDiagram.nodes) expect(html).toContain(node.label);
    expect(count(html, 'marker-end="url(#hub-arrow)"')).toBe(exampleSlides.hubDiagram.nodes.length);
  });

  it("marks content and texts for the render QA (§9)", () => {
    const html = render(exampleSlides.flow);
    expect(count(html, 'data-qa="content"')).toBeGreaterThanOrEqual(
      exampleSlides.flow.nodes.length + 1,
    );
    expect(html).toContain('data-qa="text"');
  });

  it("fails loudly for a preset without templates", () => {
    const soft = parseTheme("soft", defaultTokens("soft"));
    if (!soft.ok) throw new Error("tokens inválidos");
    expect(() =>
      renderToStaticMarkup(<SlideContent theme={soft.theme} slide={exampleSlides.flow} />),
    ).toThrow(/soft/);
  });
});

describe("titleSize", () => {
  it("shrinks as the title gets longer, ignoring emphasis marks", () => {
    expect(titleSize("Corto")).toBe(100);
    expect(titleSize("*Corto*")).toBe(100);
    expect(titleSize("Respondés las *mismas preguntas* una y otra vez.")).toBe(84); // 47 chars
    expect(titleSize("El *seguimiento* depende de que alguien se acuerde.")).toBe(70); // 49
    expect(titleSize("No necesitás una app gigante")).toBe(84);
  });
});

describe("fitFontSize", () => {
  it("keeps the base size when every label fits", () => {
    expect(fitFontSize(["Horarios", "Precios"], 200, { base: 29, min: 20 })).toBe(29);
  });

  it("shrinks every label to the size the longest word needs, down to the minimum", () => {
    const size = fitFontSize(["Precios", "Disponibilidad"], 150, { base: 29, min: 18 });
    expect(size).toBeLessThan(29);
    expect(size).toBe(fitFontSize(["Disponibilidad"], 150, { base: 29, min: 18 }));
    expect(fitFontSize(["Disponibilidad"], 40, { base: 29, min: 18 })).toBe(18);
  });

  it("measures whole labels when they must stay on one line", () => {
    const words = fitFontSize(["Estado del pedido"], 180, { base: 26, min: 10 });
    const line = fitFontSize(["Estado del pedido"], 180, { base: 26, min: 10, oneLine: true });
    expect(line).toBeLessThan(words);
  });
});
