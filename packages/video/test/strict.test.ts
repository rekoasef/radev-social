// The controls added after the first real video (docs/VIDEO-CALIDAD.md).
import { describe, expect, it } from "vitest";
import {
  aiScriptSchema,
  checkPublication,
  checkScript,
  compactDossier,
  editScene,
  tidyScript,
} from "../src";
import { monaCandidates, monaDossier, monaPublication, monaScript } from "./fixtures";

const candidates = monaCandidates();
const dossierText = compactDossier(monaDossier()).text;

describe("exact: an image that is not the thing narrated", () => {
  it("needs a caption saying what it is", () => {
    const script = monaScript();
    const scene = script.scenes[0];
    if (!scene) throw new Error("sin escenas");
    scene.exact = false;
    delete scene.caption;
    expect(checkScript(script, candidates, dossierText).join()).toContain("scenes.0.caption");
    scene.caption = "El Louvre, en una foto actual";
    expect(checkScript(script, candidates, dossierText).join()).not.toContain("scenes.0.caption");
  });

  it("is required from the AI, but not from scripts already stored", () => {
    expect(aiScriptSchema.safeParse(monaScript()).success).toBe(false);
    expect(checkScript(monaScript(), candidates, dossierText)).toEqual([]);
  });

  it("keeps the thumbnail off an image that only stands in for something", () => {
    const script = monaScript();
    const publication = monaPublication();
    for (const s of script.scenes) s.exact = s.image !== publication.thumbnail.image;
    const starts = script.scenes.map((_, i) => i * 7);
    expect(checkPublication(publication, script, starts).join()).toContain("no es del hecho mismo");
  });
});

describe("a new image at the desk", () => {
  it("takes away the name card it does not back, and the AI's `exact`", () => {
    const script = monaScript();
    const index = script.scenes.findIndex((s) => s.graphics.some((g) => g.kind === "nombre"));
    const scene = script.scenes[index];
    if (!scene) throw new Error("sin cartel en el ejemplo");
    scene.exact = true;
    const used = new Set(script.scenes.map((s) => s.image));
    const unused = candidates.find((c) => !used.has(c.id));
    if (!unused) throw new Error("sin imagen libre");
    const other = { ...unused, title: "Una calle de París", description: "" };
    const result = editScene(
      script,
      { scene: index + 1, image: other.id },
      candidates.map((c) => (c.id === other.id ? other : c)),
      dossierText,
    );
    if (!result.ok) throw new Error(result.errors.join());
    const edited = result.script.scenes[index];
    expect(edited?.graphics.some((g) => g.kind === "nombre")).toBe(false);
    expect(edited?.exact).toBeUndefined();
  });
});

describe("the script in fewer tries (stage 5)", () => {
  it("says which scenes to shorten and by how much", () => {
    const script = monaScript();
    const first = script.scenes[0];
    if (!first) throw new Error("sin escenas");
    first.narration = `${first.narration} ${"palabra ".repeat(80)}`.trim();
    const error = checkScript(script, candidates, dossierText).find((e) => e.includes("sobran"));
    expect(error).toMatch(
      /sobran \d+ para llegar a 1\.800: acortá las más largas \(escenas 1 \(\d+\)/,
    );
  });

  it("fixes by code a label that repeats the unit", () => {
    const script = monaScript();
    const scene = script.scenes[0];
    if (!scene) throw new Error("sin escenas");
    scene.graphics = [
      {
        kind: "cifra",
        value: 26,
        unit: "horas",
        label: "horas sin que nadie lo notara",
        pos: "abajo",
        at: 0,
      },
    ];
    const tidy = tidyScript(script);
    expect(tidy.scenes[0]?.graphics[0]).toMatchObject({ label: "sin que nadie lo notara" });
    expect(script.scenes[0]?.graphics[0]).toMatchObject({ label: "horas sin que nadie lo notara" });
  });
});
