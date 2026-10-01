import { describe, expect, it } from "vitest";
import { type BrandContext, buildBrandClaudeMd } from "./brand-instructions";

const brand: BrandContext = {
  name: "RAdev",
  documents: {
    voice: "# Voz\n\nDirecta y concreta.\n\n## Público\n\nPymes.",
    pricing: "- Landing: USD 300–500",
    rules: "- No prometer plazos.",
  },
  pillars: [
    {
      key: "business-problems",
      name: "Problemas de negocio",
      description: "Dolores reales",
      targetShare: 0.4,
      goal: "reach",
      hookTypes: ["warning", "question"],
      guide: "Un dolor concreto\nde un tipo de negocio.",
      closing: "Pregunta para comentar.",
      avoid: "",
    },
    { key: "how-to", name: "Cómo se hace", description: "", targetShare: 0.25 },
  ],
  whatsappNumber: "+5493410000000",
};

describe("buildBrandClaudeMd", () => {
  const md = buildBrandClaudeMd(brand);

  it("states the no-invented-numbers rule", () => {
    expect(md).toContain("Nunca inventes números");
  });

  it("includes each document under its section, voice before rules before pricing", () => {
    const voice = md.indexOf("## Voz de la marca");
    const rules = md.indexOf("## Reglas");
    const pricing = md.indexOf("## Precios");
    expect(voice).toBeGreaterThan(0);
    expect(rules).toBeGreaterThan(voice);
    expect(pricing).toBeGreaterThan(rules);
    expect(md).toContain("USD 300–500");
  });

  it("nests the documents' own headings one level down", () => {
    expect(md).toContain("\n### Voz\n");
    expect(md).toContain("\n#### Público\n");
    expect(md).not.toMatch(/^# Voz$/m);
  });

  it("leaves out documents the brand doesn't have", () => {
    expect(md).not.toContain("## Casos");
  });

  it("lists the pillars with their keys and shares", () => {
    expect(md).toContain("`business-problems` — **Problemas de negocio** (40 %): Dolores reales");
    expect(md).toContain("`how-to` — **Cómo se hace** (25 %)");
  });

  it("gives each pillar its guide below, leaving out what it doesn't have", () => {
    const [, block] = md.split("`business-problems`");
    const lines = block?.split("\n- `how-to`")[0] ?? "";
    expect(lines).toContain("  - Objetivo: alcance");
    expect(lines).toContain("  - Ganchos preferidos: `warning`, `question`");
    // One line per field, even when the operator wrote it in several.
    expect(lines).toContain("  - Cómo se cuenta: Un dolor concreto de un tipo de negocio.");
    expect(lines).toContain("  - Cómo cierra: Pregunta para comentar.");
    expect(lines).not.toContain("Evitar");
    expect(md).toContain("`how-to` — **Cómo se hace** (25 %)\n");
  });

  it("mentions WhatsApp for the cta without writing the number", () => {
    expect(md).toContain("WhatsApp");
    expect(md).not.toContain("+5493410000000");
  });

  it("sends the cta to the website when the brand has one, over WhatsApp", () => {
    const withSite = buildBrandClaudeMd({ ...brand, website: "radev.tech" });
    expect(withSite).toContain('"Entrá a radev.tech"');
    expect(withSite).toContain("no invites a escribir por WhatsApp");
    expect(withSite).not.toContain("+5493410000000");
  });

  it("works for a brand with nothing loaded yet", () => {
    const empty = buildBrandClaudeMd({ name: "Nueva", documents: {}, pillars: [] });
    expect(empty).toContain("# Nueva");
    expect(empty).not.toContain("## Pilares");
    expect(empty.endsWith("\n")).toBe(true);
  });
});
