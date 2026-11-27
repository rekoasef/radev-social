import { describe, expect, it } from "vitest";
import {
  applyFixes,
  checkScript,
  compactDossier,
  frameKey,
  frameProps,
  reviewView,
  type Script,
} from "../src";
import { monaCandidates, monaDossier, monaScript } from "./fixtures";

const candidates = monaCandidates();
const dossierText = compactDossier(monaDossier()).text;

const OPINION = "Para mí, lo más raro es que nadie lo notara enseguida.";

/** The Mona Lisa script with the operator's opinion in the given scenes (0-based). */
const withOpinion = (at: number[] = [5], narration = OPINION): Script => {
  const s = monaScript();
  for (const i of at) {
    const scene = s.scenes[i];
    if (!scene) continue;
    scene.beat = "aporte";
    scene.narration = narration;
    scene.graphics = [];
    delete scene.highlight;
  }
  return s;
};

const found = (s: Script, contribution?: boolean) =>
  checkScript(s, candidates, dossierText, { contribution, repeats: "free" })
    // the length of the fixture is not what is tested here
    .filter((e) => e.includes("aporte"))
    .join("\n");

describe("checkScript: «tu aporte»", () => {
  it("accepts one or two scenes in the middle, in first person", () => {
    expect(found(withOpinion(), true)).toBe("");
    expect(found(withOpinion([5, 9]), true)).toBe("");
  });

  it("asks for it when the operator wrote one, and refuses it when they did not", () => {
    expect(found(monaScript(), true)).toContain("hay 0");
    expect(found(withOpinion([4, 5, 6]), true)).toContain("hay 3");
    expect(found(withOpinion(), false)).toContain("sacá las escenas");
    expect(found(monaScript(), false)).toBe("");
  });

  it("never first nor last", () => {
    const last = monaScript().scenes.length - 1;
    expect(found(withOpinion([0]), true)).toContain("scenes.0.beat");
    expect(found(withOpinion([last]), true)).toContain(`scenes.${last}.beat`);
  });

  it.each([
    "Creo que nadie quiso mirar con atención ese día.",
    "Me parece que el museo confió demasiado en sí mismo.",
    "A mí lo que me sorprende es la calma de todos.",
  ])("takes «%s» as first person", (narration) => {
    expect(found(withOpinion([5], narration), true)).toBe("");
  });

  it.each([
    "El museo confió demasiado en sí mismo ese día.",
    "Nadie sabe quién creó semejante confusión en el museo.",
  ])("refuses «%s»", (narration) => {
    expect(found(withOpinion([5], narration), true)).toContain("primera persona");
  });
});

describe("the fact check and the frames with «tu aporte»", () => {
  it("tells the verifier which scenes are opinion", () => {
    const view = reviewView(withOpinion(), candidates);
    expect(view.scenes[5]).toMatchObject({ opinion: true });
    expect(view.scenes[4]).not.toHaveProperty("opinion");
  });

  it("drops a correction that takes the first person out", () => {
    const result = applyFixes(
      withOpinion(),
      [
        {
          scene: 6,
          kind: "estilo",
          problem: "suena personal",
          narration: "Nadie lo notó enseguida en el museo ese día.",
        },
      ],
      candidates,
      dossierText,
    );
    expect(result.applied).toEqual([]);
    expect(result.rejected[0]?.why).toContain("primera persona");
  });

  it("marks the frame, without renaming the frames of the other scenes", () => {
    const scene = withOpinion().scenes[5];
    const plain = monaScript().scenes[5];
    const candidate = candidates.find((c) => c.id === scene?.image);
    if (!scene || !plain || !candidate) throw new Error("fixture");
    expect(frameProps(scene, candidate, "9x16").opinion).toBe(true);
    expect(frameProps(plain, candidate, "9x16")).not.toHaveProperty("opinion");
    expect(frameKey({ ...plain, beat: "hecho" }, candidate)).toBe(frameKey(plain, candidate));
    expect(frameKey({ ...plain, beat: "aporte" }, candidate)).not.toBe(frameKey(plain, candidate));
  });
});
