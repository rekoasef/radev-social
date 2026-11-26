import { dossierSchema, imagesDocSchema, type SourcesDoc, scriptSchema } from "@radev/video";
import { describe, expect, it } from "vitest";
import candidates from "../../../packages/video/test/fixtures/mona-candidates.json";
import dossier from "../../../packages/video/test/fixtures/mona-dossier.json";
import mona from "../../../packages/video/test/fixtures/mona-script.json";
import { diffWords, sceneOfFact, scriptDesk } from "./video-script";

const script = scriptSchema.parse(mona);
const sources: SourcesDoc = {
  facts: [{ id: "F2", url: "u", result: "no-esta", overlap: 0, missingNumbers: [] }],
  summary: { textual: 0, casi: 0, noEsta: 1, sinPagina: 0 },
};
const before = structuredClone(script);
before.scenes[3]!.narration = "La obra colgaba entre un Correggio y un Tiziano.";
const view = scriptDesk({
  videoId: "v1",
  script,
  images: imagesDocSchema.parse({ candidates }),
  dossier: dossierSchema.parse(dossier),
  sources,
  review: {
    applied: [
      {
        scene: 4,
        kind: "no-respaldado",
        problem: "F3 dice cuatro clavijas.",
        narration: script.scenes[3]!.narration,
      },
    ],
    rejected: [],
  },
  beforeReview: before,
});

describe("scriptDesk", () => {
  it("lists every scene with its image from the video's folder and its estimated time", () => {
    expect(view.scenes).toHaveLength(script.scenes.length);
    expect(view.scenes[0]).toMatchObject({ n: 1, start: "0:00" });
    expect(view.scenes[0]?.image?.src).toBe(
      `/media/videos/v1/images/${script.scenes[0]?.image}.small.jpg`,
    );
    expect(view.seconds).toBeGreaterThan(100);
  });

  it("keeps every fact, placed on its scene when one says it", () => {
    expect(view.facts).toHaveLength(script.facts.length);
    const age = view.facts.find((f) => f.id === "F2");
    expect(age).toMatchObject({ result: "no-esta", scene: 3 });
    expect(view.scenes[2]).toMatchObject({ unverified: true });
  });

  it("shows what the fact check changed", () => {
    const fix = view.scenes[3]?.fix;
    expect(fix?.problem).toBe("F3 dice cuatro clavijas.");
    expect(fix?.after.some((p) => p.changed && p.text.includes("clavijas"))).toBe(true);
  });

  it("marks the images used more than once", () => {
    const repeated = view.scenes.filter((s) => s.repeated.length > 0);
    for (const scene of repeated) {
      for (const other of scene.repeated) {
        expect(view.scenes[other - 1]?.image?.id).toBe(scene.image?.id);
      }
    }
  });
});

describe("helpers", () => {
  it("diffs word by word", () => {
    expect(diffWords("sostenida por clavijas", "sostenida apenas por clavijas").after).toEqual([
      { text: "sostenida", changed: false },
      { text: "apenas", changed: true },
      { text: "por clavijas", changed: false },
    ]);
  });

  it("leaves a fact unplaced when no scene says it", () => {
    expect(sceneOfFact("El director renunció meses después", ["El Louvre amanece cerrado"])).toBe(
      null,
    );
  });
});
