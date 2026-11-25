import { describe, expect, it } from "vitest";
import {
  buildCredits,
  buildDescription,
  buildShortDescription,
  checkPublication,
  publicationSchema,
  sceneStarts,
} from "../src";
import { monaCandidates, monaDossier, monaManifest, monaPublication, monaScript } from "./fixtures";

const script = monaScript();
const publication = monaPublication();
const starts = sceneStarts(
  monaManifest().scenes.map((s) => s.frames),
  script.scenes.map((s) => s.tail),
);
const input = {
  publication,
  script,
  candidates: monaCandidates(),
  facts: monaDossier().facts,
  starts,
};

describe("sceneStarts", () => {
  it("suma la voz y la cola de cada escena", () => {
    expect(sceneStarts([30, 60, 30], [undefined, 1, undefined])).toEqual([0, 1, 4]);
  });
});

describe("publicación de la Mona Lisa", () => {
  it("cumple el schema y los controles", () => {
    expect(publicationSchema.safeParse(publication).success).toBe(true);
    expect(checkPublication(publication, script, starts)).toEqual([]);
  });

  it("rechaza una miniatura con una imagen que el video no usa", () => {
    const m = structuredClone(publication);
    m.thumbnail.image = "i99";
    expect(checkPublication(m, script, starts).join("\n")).toMatch(/no se usa en el video/);
  });

  it("rechaza más de 6 palabras y un acento que no está en las líneas", () => {
    const m = structuredClone(publication);
    m.thumbnail.lines = ["UNO DOS TRES", "CUATRO CINCO", "SEIS SIETE"];
    m.thumbnail.accent = "OTRA";
    const e = checkPublication(m, script, starts).join("\n");
    expect(e).toMatch(/7 palabras; máximo 6/);
    expect(e).toMatch(/accent/);
  });

  it("rechaza capítulos que no empiezan en la escena 1 o a menos de 10 s", () => {
    const m = structuredClone(publication);
    m.chapters = [
      { scene: 2, title: "Empieza tarde" },
      { scene: 3, title: "Muy pegado" },
      { scene: 4, title: "Otro más" },
      { scene: 5, title: "Y otro más" },
    ];
    const e = checkPublication(m, script, starts).join("\n");
    expect(e).toMatch(/el primero tiene que ser la escena 1/);
    expect(e).toMatch(/a menos de 10 s del anterior/);
  });
});

describe("descripciones", () => {
  it("la del video normal lleva capítulos con minutos, fuentes y créditos", () => {
    const d = buildDescription(input);
    expect(d.startsWith(publication.title)).toBe(true);
    expect(d).toContain("Capítulos\n0:00 ");
    expect(d).toContain("Fuentes\n- ");
    expect(d).toContain("Imágenes de archivo (Wikimedia Commons)");
    expect(d).toContain("Narración con voz generada por IA");
    expect(d).not.toContain("#Shorts");
    // un capítulo por cada uno de la publicación
    expect(d.match(/^\d+:\d{2} /gm)).toHaveLength(publication.chapters.length);
  });

  it("la del Short no lleva capítulos y termina con #Shorts", () => {
    const d = buildShortDescription(input);
    expect(d).not.toContain("Capítulos");
    expect(d).toContain("Fuentes\n- ");
    expect(d).toContain("Narración con voz generada por IA");
    expect(d.trimEnd().endsWith("#Shorts")).toBe(true);
  });

  it("las fuentes salen solo de los hechos que usa el guion, sin repetir sitios", () => {
    const d = buildDescription(input);
    const lines = d
      .split("\n")
      .filter(
        (l) => l.startsWith("- ") && l.includes("https://") && !l.includes("commons.wikimedia.org"),
      );
    expect(lines.length).toBeGreaterThan(0);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it("`creditos.txt` lista cada imagen usada una sola vez", () => {
    const used = new Set(script.scenes.map((s) => s.image));
    const c = buildCredits(script, monaCandidates());
    expect(c.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(used.size);
  });
});
