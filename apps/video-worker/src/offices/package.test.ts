import type { Publication, VoiceDoc } from "@radev/video";
import { describe, expect, it, vi } from "vitest";
import candidatesFixture from "../../../../packages/video/test/fixtures/mona-candidates.json";
import dossierFixture from "../../../../packages/video/test/fixtures/mona-dossier.json";
import publicationFixture from "../../../../packages/video/test/fixtures/mona-publication.json";
import scriptFixture from "../../../../packages/video/test/fixtures/mona-script.json";
import manifest from "../../../../packages/video/test/fixtures/mona-voice-manifest.json";
import { answer, failure, makeCtx } from "./harness";
import { createPackageOffice } from "./package";

const publication = (): Publication => structuredClone(publicationFixture);
const voice: VoiceDoc = {
  fingerprint: "f",
  voiceId: "v",
  model: "m",
  speed: null,
  characters: 1,
  fps: 30,
  totalFrames: manifest.scenes.reduce((n, s) => n + s.frames, 0),
  full: "voice/full.mp3",
  scenes: manifest.scenes.map((s, i) => ({
    index: i,
    frames: s.frames,
    text: s.text,
    audio: `voice/s${i}.wav`,
    words: `voice/s${i}.json`,
  })),
};
const docs = () => ({
  script: structuredClone(scriptFixture),
  dossier: structuredClone(dossierFixture),
  images: { candidates: structuredClone(candidatesFixture) },
  voice,
});
const small = () =>
  Object.fromEntries(
    candidatesFixture.map((c) => [`images/${c.id}.small.jpg`, new Uint8Array([1])]),
  );
const renderer = () => ({
  renderStills: vi.fn(async (_jobs: readonly { outFile: string }[]) => {}),
});

describe("package office", () => {
  it("leaves both descriptions, the credits and both thumbnails", async () => {
    const r = renderer();
    const { ctx, files, asked } = makeCtx({
      docs: docs(),
      answers: [answer(publication(), "run-pub")],
      files: small(),
    });
    const out = await createPackageOffice({ renderer: r })(ctx);
    if (out.kind !== "done") throw new Error("debía terminar");
    const doc = out.documents[0]?.data as {
      descriptionNormal: string;
      descriptionShort: string;
      thumbnails: Record<string, string>;
    };
    expect(out.documents[0]).toMatchObject({ kind: "package", generationRunId: "run-pub" });
    expect(doc.descriptionNormal).toContain("Capítulos");
    expect(doc.descriptionShort).not.toContain("Capítulos");
    expect(doc.descriptionShort.trimEnd().endsWith("#Shorts")).toBe(true);
    expect(
      files.has("package/descripcion.txt") &&
        files.has("package/descripcion-short.txt") &&
        files.has("package/creditos.txt"),
    ).toBe(true);
    expect(r.renderStills).toHaveBeenCalledOnce();
    const jobs = r.renderStills.mock.calls[0]?.[0] as {
      outFile: string;
      props: { format: string };
    }[];
    expect(jobs.map((j) => j.outFile)).toEqual([
      "/media/videos/v1/package/miniatura-9x16.png",
      "/media/videos/v1/package/miniatura-16x9.png",
    ]);
    expect(asked[0]).toMatchObject({ task: "video.package", effort: "low" });
    expect(doc.thumbnails["16x9"]).toBe("package/miniatura-16x9.png");
  });

  it("asks again when the thumbnail uses an image the video does not show", async () => {
    const bad = publication();
    bad.thumbnail.image = "i99";
    const { ctx, asked } = makeCtx({
      docs: docs(),
      answers: [answer(bad), answer(publication(), "run-2")],
      files: small(),
    });
    const out = await createPackageOffice({ renderer: renderer() })(ctx);
    expect(out).toMatchObject({ kind: "done", documents: [{ generationRunId: "run-2" }] });
    expect(asked[1]?.prompt).toContain("no se usa en el video");
    expect(asked[1]?.images).toBeUndefined();
  });

  it("fails after 3 bad publications", async () => {
    const bad = publication();
    bad.thumbnail.image = "i99";
    const { ctx } = makeCtx({
      docs: docs(),
      answers: [answer(bad), answer(bad), answer(bad)],
      files: small(),
    });
    await expect(createPackageOffice({ renderer: renderer() })(ctx)).rejects.toThrow(
      /no pasó los controles/,
    );
  });

  it("returns Claude's limit", async () => {
    const { ctx } = makeCtx({
      docs: docs(),
      answers: [failure({ kind: "rate_limited", message: "l", retryAfterMs: null })],
      files: small(),
    });
    expect(await createPackageOffice({ renderer: renderer() })(ctx)).toEqual({
      kind: "rate_limited",
      retryAfterMs: null,
    });
  });
});
