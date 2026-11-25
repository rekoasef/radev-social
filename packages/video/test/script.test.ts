import { describe, expect, it } from "vitest";
import { checkScript, compactDossier, normalizeHighlights, scriptSchema } from "../src";
import { monaCandidates, monaDossier, monaScript } from "./fixtures";

const candidates = monaCandidates();
const dossierText = compactDossier(monaDossier()).text;
const errorsOf = (s: ReturnType<typeof monaScript>) => checkScript(s, candidates, dossierText);

describe("guion de la Mona Lisa (verificado y publicado)", () => {
  it("cumple el schema", () => {
    expect(scriptSchema.safeParse(monaScript()).success).toBe(true);
  });

  it("no tiene errores de sentido", () => {
    expect(errorsOf(monaScript())).toEqual([]);
  });
});

describe("checkScript detecta errores conocidos", () => {
  it("un número que no está en el dossier (regla 9)", () => {
    const s = monaScript();
    s.scenes[3]!.narration = `${s.scenes[3]!.narration} Eran 7777 personas.`;
    expect(errorsOf(s).join("\n")).toMatch(/7777.*no está en el dossier/);
  });

  it("una cifra en pantalla inventada", () => {
    const s = monaScript();
    s.scenes[0]!.graphics.push({
      kind: "cifra",
      value: 98765,
      label: "dato inventado",
      pos: "centro",
      at: 0,
    });
    expect(errorsOf(s).join("\n")).toMatch(/98765/);
  });

  it("una fecha en pantalla que la voz no dice", () => {
    const s = monaScript();
    const sc = s.scenes.find((x) => x.graphics.some((g) => g.kind === "fecha"))!;
    const g = sc.graphics.find((x) => x.kind === "fecha");
    if (g?.kind === "fecha") g.text = "4 DE ENERO DE 1914";
    expect(errorsOf(s).join("\n")).toMatch(/la fecha en pantalla incluye/);
  });

  it("una palabra de enganche que no está en la narración", () => {
    const s = monaScript();
    s.scenes[1]!.highlight = ["inexistente"];
    expect(errorsOf(s).join("\n")).toMatch(/"inexistente" no está en la narración/);
  });

  it("una imagen que no es candidata", () => {
    const s = monaScript();
    s.scenes[2]!.image = "i999";
    expect(errorsOf(s).join("\n")).toMatch(/i999.*no es una imagen candidata/);
  });

  it("la misma imagen seguida con el mismo encuadre", () => {
    const s = monaScript();
    s.scenes[5]!.image = s.scenes[4]!.image;
    s.scenes[5]!.from = structuredClone(s.scenes[4]!.to);
    expect(errorsOf(s).join("\n")).toMatch(/misma imagen que la escena anterior/);
  });

  it("una narración demasiado corta", () => {
    const s = monaScript();
    s.scenes = s.scenes.slice(0, 10);
    expect(errorsOf(s).join("\n")).toMatch(/caracteres; tienen que ser/);
  });

  it("la última escena sin pregunta", () => {
    const s = monaScript();
    const last = s.scenes.at(-1)!;
    last.narration = last.narration.replace(/\?/g, ".");
    expect(errorsOf(s).join("\n")).toMatch(/terminar con una pregunta/);
  });

  it("una imagen repetida más de 3 veces", () => {
    const s = monaScript();
    for (const i of [0, 3, 6, 9]) s.scenes[i]!.image = "i01";
    expect(errorsOf(s).join("\n")).toMatch(/se usa \d+ veces/);
  });
});

describe("normalizeHighlights", () => {
  it("splits phrases into single words and drops short and repeated ones", () => {
    const s = monaScript();
    s.scenes[0]!.highlight = ["el Louvre", "Louvre", "de", "agosto 1911 amanece cerrado"];
    const out = normalizeHighlights(s);
    expect(out.scenes[0]!.highlight).toEqual(["Louvre", "agosto", "1911", "amanece"]);
    expect(s.scenes[0]!.highlight).toHaveLength(4); // the original is untouched
  });
});
