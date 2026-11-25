import { describe, expect, it } from "vitest";
import { applyFixes, checkScript, compactDossier, reviewSchema, reviewView } from "../src";
import { monaCandidates, monaDossier, monaScript } from "./fixtures";

const candidates = monaCandidates();
const dossierText = compactDossier(monaDossier()).text;
const apply = (fixes: Parameters<typeof applyFixes>[1], script = monaScript()) =>
  applyFixes(script, fixes, candidates, dossierText);

describe("applyFixes", () => {
  it("aplica una aclaración de imagen y no toca el guion original", () => {
    const original = monaScript();
    const before = JSON.stringify(original);
    const r = apply(
      [
        {
          scene: 2,
          kind: "imagen",
          problem: "es una foto actual del lugar",
          caption: "El Louvre, foto actual",
        },
      ],
      original,
    );
    expect(r.applied).toHaveLength(1);
    expect(r.script.scenes[1]!.caption).toBe("El Louvre, foto actual");
    expect(JSON.stringify(original)).toBe(before);
  });

  it("rechaza una corrección que mete un número fuera del dossier", () => {
    const r = apply([
      {
        scene: 3,
        kind: "numero",
        problem: "cifra mal",
        narration: `${monaScript().scenes[2]!.narration} Fueron 424242.`,
      },
    ]);
    expect(r.applied).toHaveLength(0);
    expect(r.rejected[0]!.why).toMatch(/424242/);
  });

  it("rechaza una escena inexistente", () => {
    const r = apply([
      { scene: 99, kind: "estilo", problem: "no existe esta escena", caption: "x" },
    ]);
    expect(r.rejected[0]!.why).toBe("escena inexistente");
  });

  it("rechaza corregir una cita donde no hay cita", () => {
    const s = monaScript();
    const sc = s.scenes.findIndex((x) => !x.graphics.some((g) => g.kind === "cita"));
    const r = apply(
      [{ scene: sc + 1, kind: "cita", problem: "no es fiel", cita: { text: "x", by: "y" } }],
      s,
    );
    expect(r.rejected[0]!.why).toBe("la escena no tiene cita");
  });

  it("una imagen nueva sin encuadre recibe un acercamiento por defecto y el resultado sigue siendo válido", () => {
    const s = monaScript();
    const used = new Set(s.scenes.map((x) => x.image));
    const other = candidates.find((c) => !used.has(c.id))!;
    const r = apply(
      [{ scene: 4, kind: "imagen", problem: "muestra otra cosa", image: other.id }],
      s,
    );
    expect(r.applied).toHaveLength(1);
    expect(r.script.scenes[3]!.image).toBe(other.id);
    expect(r.script.scenes[3]!.from).toEqual({ cx: 0.5, cy: 0.5, vw: 1 });
    expect(checkScript(r.script, candidates, dossierText)).toEqual([]);
  });

  it("sin correcciones devuelve el mismo guion", () => {
    const r = apply([]);
    expect(r.script).toEqual(monaScript());
  });
});

describe("reviewSchema y reviewView", () => {
  it("acepta una lista vacía de correcciones", () => {
    expect(reviewSchema.safeParse({ fixes: [] }).success).toBe(true);
  });

  it("la vista para la IA trae el título de la imagen y no los encuadres", () => {
    const v = reviewView(monaScript(), candidates);
    expect(v.scenes).toHaveLength(monaScript().scenes.length);
    expect(v.scenes[0]!.image).toBeTruthy();
    expect(JSON.stringify(v)).not.toContain('"vw"');
  });
});
