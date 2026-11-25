import { describe, expect, it } from "vitest";
import { checkDossier, compactDossier, dossierSchema } from "../src";
import { monaDossier } from "./fixtures";

describe("dossier", () => {
  it("el de la Mona Lisa cumple el schema y los controles", () => {
    const d = monaDossier();
    expect(dossierSchema.safeParse(d).success).toBe(true);
    expect(checkDossier(d)).toEqual([]);
  });

  it("rechaza datos de prueba (V0-13: example.com y «test»)", () => {
    const d = monaDossier();
    d.facts[0] = { ...d.facts[0]!, url: "https://example.com/x", claim: "test" };
    expect(checkDossier(d).join("\n")).toMatch(/datos de prueba/);
  });

  it("rechaza un hecho cuyo extracto es el mismo hecho", () => {
    const d = monaDossier();
    d.facts[1] = { ...d.facts[1]!, excerpt: d.facts[1]!.claim };
    expect(checkDossier(d).join("\n")).toMatch(/datos de prueba o de relleno/);
  });

  it("exige al menos 3 sitios distintos", () => {
    const d = monaDossier();
    d.facts = d.facts.map((f) => ({ ...f, url: "https://a.org/x" }));
    expect(checkDossier(d).join("\n")).toMatch(/solo 1 sitios distintos/);
  });

  it("rechaza ids repetidos", () => {
    const d = monaDossier();
    d.facts[1] = { ...d.facts[1]!, id: d.facts[0]!.id };
    expect(checkDossier(d).join("\n")).toMatch(/id repetido/);
  });

  it("el dossier compacto no lleva extractos ni urls, pero el texto de control sí", () => {
    const { text, json } = compactDossier(monaDossier());
    expect(json).not.toContain("excerpt");
    expect(json).not.toContain("https://");
    expect(text).toContain("excerpt");
    expect(json.length).toBeLessThan(text.length);
  });
});
