import { describe, expect, it } from "vitest";
import { canDownload, packageFiles, packageSlug } from "./download";
import { canReuseVoice, voiceFingerprint } from "./voice";

const input = { texts: ["Hola mundo.", "¿Cómo estás?"], voiceId: "v1", model: "m1", speed: null };

describe("voice reuse (the voice is paid for)", () => {
  it("reuses the audio when nothing changed, even with other whitespace", () => {
    const saved = voiceFingerprint(input);
    expect(canReuseVoice(saved, { ...input, texts: ["Hola   mundo. ", "¿Cómo estás?"] })).toBe(
      true,
    );
  });

  it.each([
    ["a text", { texts: ["Hola mundo.", "¿Cómo andás?"] }],
    ["the order of the scenes", { texts: ["¿Cómo estás?", "Hola mundo."] }],
    ["the voice", { voiceId: "v2" }],
    ["the model", { model: "m2" }],
    ["the speed", { speed: 1.1 }],
  ])("makes the voice again when %s changes", (_what, change) => {
    expect(canReuseVoice(voiceFingerprint(input), { ...input, ...change })).toBe(false);
  });

  it("makes the voice when there is none yet", () => {
    expect(canReuseVoice(null, input)).toBe(false);
    expect(canReuseVoice(undefined, input)).toBe(false);
  });
});

describe("download", () => {
  it("only an approved video can be downloaded", () => {
    expect(canDownload("approved")).toBe(true);
    for (const stage of ["in_review", "script_review", "voicing", "archived"] as const) {
      expect(canDownload(stage), stage).toBe(false);
    }
  });

  it("slugs the title for the folder", () => {
    expect(packageSlug("El robo de la Mona Lisa: el misterio que vació el Louvre en 1911")).toBe(
      "el-robo-de-la-mona-lisa-el-misterio-que-vacio-el-louvre-en",
    );
    expect(packageSlug("¿¿??")).toBe("video");
  });

  it("lays out the same folder the V0 spike left: short and normal, three files each", () => {
    expect(packageFiles("mona").map((f) => f.path)).toEqual([
      "mona/short/video.mp4",
      "mona/short/miniatura.png",
      "mona/short/descripcion.txt",
      "mona/normal/video.mp4",
      "mona/normal/miniatura.png",
      "mona/normal/descripcion.txt",
    ]);
  });
});
