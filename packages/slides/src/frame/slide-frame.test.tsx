import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultTokens, parseTheme } from "../presets/registry";
import { SlideFrame, type SlideFrameProps } from "./slide-frame";

const parsed = parseTheme("bold", {
  ...defaultTokens("bold"),
  header: { left: "Procesos de hoy", right: "Resultados de mañana" },
  footer: { tagline: ["Automatización", "Ideas en resultados"] },
  wordmark: { strong: "RA", light: "dev", dot: true },
});
if (!parsed.ok) throw new Error(parsed.issues.join("\n"));
const theme = parsed.theme;

function render(props: Partial<SlideFrameProps> = {}) {
  return renderToStaticMarkup(
    <SlideFrame
      theme={theme}
      brandName="RAdev"
      page={{ index: 2, total: 7 }}
      seed="post-1"
      {...props}
    />,
  );
}

describe("SlideFrame (bold)", () => {
  it("renders at 1080×1350 with the brand's labels, wordmark and page", () => {
    const html = render();
    expect(html).toContain("width:1080px;height:1350px");
    expect(html).toContain("Procesos de hoy");
    expect(html).toContain(">RA<");
    expect(html).toContain("03<span");
    expect(html).toContain(" / 07");
  });

  it("leaves the tagline out of the footer (TikTok's buttons cover it)", () => {
    expect(render()).not.toContain("Ideas en resultados");
  });

  it("shows the swipe hint on the cover", () => {
    expect(render({ page: { index: 0, total: 7 } })).toContain("Deslizá →");
  });

  it("falls back to the brand name without wordmark tokens", () => {
    if (theme.preset !== "bold") throw new Error("preset inesperado");
    const tokens = { ...theme.tokens, wordmark: { strong: "", light: "", dot: false } };
    expect(render({ theme: { preset: "bold", tokens } })).toContain(">RAdev<");
  });

  it("draws the same decorations for the same seed", () => {
    expect(render({ seed: "post-1" })).toBe(render({ seed: "post-1" }));
    expect(render({ seed: "post-1" })).not.toBe(render({ seed: "post-9" }));
  });
});
