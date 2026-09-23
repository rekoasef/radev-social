import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { exampleSlides } from "../../../content/examples";
import { hasTemplate, SlideContent } from "../../../slide-content";
import { defaultTokens, parseTheme } from "../../registry";
import { fitFontSize, titleSize } from "../parts";

const parsed = parseTheme("bold", defaultTokens("bold"));
if (!parsed.ok) throw new Error(parsed.issues.join("\n"));
const theme = parsed.theme;

const render = (type: "cardGrid" | "flow" | "hubDiagram") =>
  renderToStaticMarkup(<SlideContent theme={theme} slide={exampleSlides[type]} />);

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("bold templates", () => {
  it("exist for cardGrid, flow and hubDiagram only (the rest: T5, T6)", () => {
    expect(hasTemplate("bold", "cardGrid")).toBe(true);
    expect(hasTemplate("bold", "flow")).toBe(true);
    expect(hasTemplate("bold", "hubDiagram")).toBe(true);
    expect(hasTemplate("bold", "cover")).toBe(false);
    expect(hasTemplate("soft", "cardGrid")).toBe(false);
  });

  it("cardGrid renders every card with its lead and label, and the emphasis in accent", () => {
    const html = render("cardGrid");
    for (const card of exampleSlides.cardGrid.cards) expect(html).toContain(card.label);
    expect(html).toContain(">una</div>");
    expect(html).toContain('<span style="color:var(--accent)">para mejorar esto.</span>');
    // The emphasis marks never reach the output.
    expect(html).not.toContain("*para");
    expect(html).not.toContain("problema.*");
  });

  it("flow draws one connector between consecutive nodes", () => {
    const html = render("flow");
    for (const node of exampleSlides.flow.nodes) expect(html).toContain(node.label);
    expect(count(html, "<polyline")).toBe(exampleSlides.flow.nodes.length - 1);
  });

  it("hubDiagram draws one arrow per node into the center", () => {
    const html = render("hubDiagram");
    for (const node of exampleSlides.hubDiagram.nodes) expect(html).toContain(node.label);
    expect(count(html, 'marker-end="url(#hub-arrow)"')).toBe(exampleSlides.hubDiagram.nodes.length);
  });

  it("marks content and texts for the render QA (§9)", () => {
    const html = render("flow");
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
