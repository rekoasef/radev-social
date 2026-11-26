import type { Review } from "@radev/video";
import { describe, expect, it } from "vitest";
import candidatesFixture from "../../../../packages/video/test/fixtures/mona-candidates.json";
import dossierFixture from "../../../../packages/video/test/fixtures/mona-dossier.json";
import scriptFixture from "../../../../packages/video/test/fixtures/mona-script.json";
import { OfficeFailure } from "../office";
import { answer, failure, makeCtx, video } from "./harness";
import { createImagesOffice } from "./images";
import { research } from "./research";
import { createReviewOffice } from "./review";
import { script } from "./script";
import { createSourcesOffice } from "./sources";

const dossier = () => structuredClone(dossierFixture);
const candidates = () => structuredClone(candidatesFixture);
const goodScript = () => structuredClone(scriptFixture);
const jpg = new Uint8Array([1, 2, 3]);
const smallFiles = () =>
  Object.fromEntries(candidates().map((c) => [`images/${c.id}.small.jpg`, jpg]));
const docs = { dossier: dossier(), images: { candidates: candidates() }, script: goodScript() };

describe("research office", () => {
  it("leaves the dossier, asking with web search and low effort", async () => {
    const { ctx, asked } = makeCtx({ answers: [answer(dossier())] });
    const r = await research(ctx);
    expect(r).toMatchObject({
      kind: "done",
      documents: [{ kind: "dossier", origin: "office", generationRunId: "run-1" }],
    });
    expect(asked[0]).toMatchObject({
      task: "video.research",
      tools: ["WebSearch", "WebFetch"],
      effort: "low",
      maxTurns: 40,
    });
    expect(asked[0]?.files["task.json"]).toContain("El robo de la Mona Lisa");
  });

  it("asks again from scratch when the dossier has test data (V0-13)", async () => {
    const fake = dossier();
    fake.facts[0] = { ...fake.facts[0]!, url: "https://example.com/x", claim: "test" };
    const { ctx, asked } = makeCtx({ answers: [answer(fake), answer(dossier(), "run-2")] });
    const r = await research(ctx);
    expect(r).toMatchObject({ kind: "done", documents: [{ generationRunId: "run-2" }] });
    expect(asked[1]?.prompt).toContain("datos de prueba");
  });

  it("fails when the second dossier is bad too", async () => {
    const fake = dossier();
    fake.facts = fake.facts.map((f) => ({ ...f, url: "https://example.com/x" }));
    const { ctx } = makeCtx({ answers: [answer(fake), answer(fake)] });
    await expect(research(ctx)).rejects.toBeInstanceOf(OfficeFailure);
  });

  it("returns Claude's limit instead of failing", async () => {
    const { ctx } = makeCtx({
      answers: [failure({ kind: "rate_limited", message: "límite", retryAfterMs: 60_000 })],
    });
    expect(await research(ctx)).toEqual({ kind: "rate_limited", retryAfterMs: 60_000 });
  });

  it("a missing route is not worth retrying", async () => {
    const { ctx } = makeCtx({
      answers: [failure({ kind: "provider_error", message: "no hay ruta", retryable: false })],
    });
    await expect(research(ctx)).rejects.toMatchObject({ retryable: false });
  });
});

describe("sources office", () => {
  it("downloads each URL once and leaves how much of each fact and quote is in its page", async () => {
    const asked: string[] = [];
    const office = createSourcesOffice({
      fetchPage: async (url) => {
        asked.push(url);
        if (url.includes("wikipedia")) throw new Error("HTTP 403");
        return "<p>nada</p>";
      },
    });
    const d = dossier();
    const readable = new Set(
      [...d.facts, ...d.quotes].map((f) => f.url).filter((u) => !u.includes("wikipedia")),
    );
    const { ctx } = makeCtx({
      docs: { dossier: d },
      answers: [...readable].map(() => answer({ items: [] })),
    });
    const r = await office(ctx);
    expect(new Set(asked).size).toBe(asked.length);
    if (r.kind !== "done") throw new Error("debía terminar");
    const doc = r.documents[0]?.data as { facts: unknown[]; summary: { sinPagina: number } };
    expect(r.documents[0]?.kind).toBe("sources");
    expect(doc.facts).toHaveLength(d.facts.length + d.quotes.length);
    expect(doc.summary.sinPagina).toBeGreaterThan(0);
  });

  it("asks an AI to find in the real page what is not there verbatim, and checks its sentence", async () => {
    const d = dossier();
    const first = d.facts[0];
    if (!first) throw new Error("fixture");
    d.facts = d.facts.map((f) => ({
      ...f,
      url: "https://a.org/1",
      excerpt: "un resumen que no está",
    }));
    d.quotes = [];
    const office = createSourcesOffice({
      fetchPage: async () => "<p>Peruggia salió del Louvre con la Mona Lisa.</p>",
    });
    const { ctx, asked } = makeCtx({
      docs: { dossier: d },
      answers: [
        answer({
          items: [
            { id: "F1", quotes: ["Peruggia salió del Louvre con la Mona Lisa."], differs: null },
          ],
        }),
      ],
    });
    const r = await office(ctx);
    if (r.kind !== "done") throw new Error("debía terminar");
    expect(asked[0]).toMatchObject({ task: "video.sources" });
    expect(asked[0]?.files["pagina.txt"]).toContain("Peruggia salió del Louvre");
    expect(asked[0]?.tools).toBeUndefined();
    const doc = r.documents[0]?.data as { facts: { result: string; checked?: boolean }[] };
    expect(doc.facts[0]).toMatchObject({ result: "textual", checked: true });
  });

  it("returns Claude's limit", async () => {
    const d = dossier();
    const office = createSourcesOffice({ fetchPage: async () => "<p>nada</p>" });
    const { ctx } = makeCtx({
      docs: { dossier: d },
      answers: [failure({ kind: "rate_limited", message: "l", retryAfterMs: null })],
    });
    expect(await office(ctx)).toEqual({ kind: "rate_limited", retryAfterMs: null });
  });

  it("fails without a dossier, and retrying would not help", async () => {
    const office = createSourcesOffice({ fetchPage: async () => "" });
    await expect(office(makeCtx({}).ctx)).rejects.toMatchObject({ retryable: false });
  });
});

describe("images office", () => {
  const hits = Array.from({ length: 40 }, (_, i) => ({
    title: `Foto ${i}`,
    description: "d",
    date: "1911",
    author: "a",
    license: "Public domain",
    page: `https://commons/p${i}`,
    width: 1500,
    height: 1000,
    score: 40 - i,
    thumb: `https://upload/${i}.jpg`,
  }));
  const downloads: string[] = [];
  const deps = {
    commons: {
      searchFiles: async () => hits,
      searchCategoryFiles: async () => [],
      fileByTitle: async () => null,
      articleFiles: async () => [],
      download: async (url: string) => {
        downloads.push(url);
        return new Uint8Array([9, 9]) as unknown as Buffer;
      },
    },
    shrink: async () => new Uint8Array([1]),
    sizeOf: () => ({ width: 1280, height: 853 }),
  };
  const queries = { queries: Array.from({ length: 10 }, (_, i) => `consulta ${i}`) };
  const keep = { keep: Array.from({ length: 30 }, (_, i) => i) };

  it("searches, curates, downloads with a small copy and leaves the candidates", async () => {
    downloads.length = 0;
    const { ctx, files, asked } = makeCtx({
      docs: { dossier: dossier() },
      answers: [answer(queries), answer(keep, "run-cur")],
    });
    const r = await createImagesOffice(deps)(ctx);
    if (r.kind !== "done") throw new Error("debía terminar");
    const doc = r.documents[0]?.data as {
      candidates: { id: string; file: string; width: number }[];
    };
    expect(doc.candidates).toHaveLength(30);
    expect(doc.candidates[0]).toMatchObject({ id: "i01", file: "images/i01.jpg", width: 1280 });
    expect(files.has("images/i01.jpg") && files.has("images/i01.small.jpg")).toBe(true);
    expect(downloads).toHaveLength(30);
    expect(asked.map((a) => a.task)).toEqual(["video.images", "video.images"]);
    expect(r.documents[0]?.generationRunId).toBe("run-cur");
  });

  it("puts the images of the dossier's Wikipedia article first, even if the curator skips them", async () => {
    const asked: string[] = [];
    const caseHits = [0, 1].map((i) => ({
      ...hits[0]!,
      title: `Retrato robot ${i}`,
      page: `https://commons/case${i}`,
      score: 300,
      article: "https://en.wikipedia.org/wiki/Caso",
    }));
    const withArticle = {
      ...deps,
      commons: {
        ...deps.commons,
        articleFiles: async (url: string) => {
          asked.push(url);
          return caseHits;
        },
      },
    };
    const d = dossier();
    for (const fact of d.facts) fact.url = "https://en.wikipedia.org/wiki/Caso";
    const { ctx } = makeCtx({
      docs: { dossier: d },
      // the curator keeps only search results (the pool puts the article's first: n 0 and 1)
      answers: [answer(queries), answer({ keep: Array.from({ length: 30 }, (_, i) => i + 2) })],
    });
    const r = await createImagesOffice(withArticle)(ctx);
    if (r.kind !== "done") throw new Error("debía terminar");
    const doc = r.documents[0]?.data as { candidates: { title: string; article?: string }[] };
    expect(asked).toEqual(["https://en.wikipedia.org/wiki/Caso"]);
    expect(doc.candidates.slice(0, 2).map((c) => c.title)).toEqual([
      "Retrato robot 0",
      "Retrato robot 1",
    ]);
    expect(doc.candidates[0]?.article).toBe("https://en.wikipedia.org/wiki/Caso");
    expect(doc.candidates).toHaveLength(32);
  });

  it("does not download again what is already on disk (a retry is cheap)", async () => {
    downloads.length = 0;
    const existing = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [
        `images/i${String(i + 1).padStart(2, "0")}.jpg`,
        jpg,
      ]).concat(
        Array.from({ length: 30 }, (_, i) => [
          `images/i${String(i + 1).padStart(2, "0")}.small.jpg`,
          jpg,
        ]),
      ),
    );
    const { ctx } = makeCtx({
      docs: { dossier: dossier() },
      answers: [answer(queries), answer(keep)],
      files: existing,
    });
    await createImagesOffice(deps)(ctx);
    expect(downloads).toHaveLength(0);
  });

  it("returns Claude's limit from either AI step", async () => {
    const limit = failure({ kind: "rate_limited", message: "l", retryAfterMs: null });
    const { ctx } = makeCtx({ docs: { dossier: dossier() }, answers: [answer(queries), limit] });
    expect(await createImagesOffice(deps)(ctx)).toEqual({
      kind: "rate_limited",
      retryAfterMs: null,
    });
  });
});

describe("script office", () => {
  it("leaves a valid script and sets the title, looking at the images", async () => {
    const { ctx, asked } = makeCtx({ docs, answers: [answer(goodScript())], files: smallFiles() });
    const r = await script(ctx);
    expect(r).toMatchObject({
      kind: "done",
      title: goodScript().title,
      documents: [{ kind: "script" }],
    });
    expect(asked[0]?.images?.length).toBe(candidates().length);
    expect(asked[0]?.effort).toBe("low");
  });

  it("asks for a fix with the errors, without sending the images again", async () => {
    const bad = goodScript();
    bad.scenes[3]!.narration += " Eran 7777 personas.";
    const { ctx, asked, rejected, progressed } = makeCtx({
      docs,
      answers: [answer(bad), answer(goodScript(), "run-2")],
      files: smallFiles(),
    });
    const r = await script(ctx);
    // The studio sees the second try and why; the history keeps the problems of the first run.
    expect(rejected).toEqual([{ runId: "run-1", problems: expect.any(Array) }]);
    expect(progressed.map((p) => p.attempt)).toEqual([1, 2]);
    expect(progressed[1]?.problems?.join(" ")).toContain("7777");
    expect(r).toMatchObject({ kind: "done", documents: [{ generationRunId: "run-2" }] });
    expect(asked[1]?.prompt).toContain("7777");
    expect(asked[1]?.images).toBeUndefined();
    expect(asked[1]?.files["anterior.json"]).toContain("7777");
  });

  it("fails after 4 bad scripts", async () => {
    const bad = goodScript();
    bad.scenes[3]!.narration += " Eran 7777 personas.";
    const { ctx } = makeCtx({
      docs,
      answers: [answer(bad), answer(bad), answer(bad), answer(bad)],
      files: smallFiles(),
    });
    await expect(script(ctx)).rejects.toThrow(/4 intentos/);
  });

  it("after a rejection, hands the AI the operator's note and the rejected script", async () => {
    const v = video({ stage: "scripting", rejectionNote: "la escena 3 usa la foto equivocada" });
    const { ctx, asked } = makeCtx({
      video: v,
      docs,
      answers: [answer(goodScript())],
      files: smallFiles(),
    });
    await script(ctx);
    expect(asked[0]?.prompt).toContain("la escena 3 usa la foto equivocada");
    expect(asked[0]?.files["anterior.json"]).toBeDefined();
  });

  it("without a rejection it sends no previous script", async () => {
    const { ctx, asked } = makeCtx({ docs, answers: [answer(goodScript())], files: smallFiles() });
    await script(ctx);
    expect(asked[0]?.files["anterior.json"]).toBeUndefined();
  });
});

describe("review office", () => {
  const noFixes: Review = { fixes: [] };
  /** A renderer that "draws" each frame into the fake media folder. */
  const drawing = (ctx: ReturnType<typeof makeCtx>["ctx"]) => ({
    renderStills: async (jobs: readonly { outFile: string }[]) => {
      for (const job of jobs) {
        await ctx.files.write(job.outFile.replace(`${ctx.mediaDir}/`, ""), jpg);
      }
    },
  });
  const run = (ctx: ReturnType<typeof makeCtx>["ctx"], renderer = drawing(ctx)) =>
    createReviewOffice({ renderer })(ctx);

  it("with nothing to fix, leaves only the review (the script stays as it is)", async () => {
    const { ctx, asked } = makeCtx({
      docs,
      answers: [answer(noFixes), answer(noFixes)],
      files: smallFiles(),
    });
    const r = await run(ctx);
    if (r.kind !== "done") throw new Error("debía terminar");
    expect(r.documents.map((d) => d.kind)).toEqual(["review"]);
    expect(asked[0]).toMatchObject({ task: "video.review", effort: "medium", maxTurns: 5 });
  });

  it("looks at the frame of every scene in both formats", async () => {
    const { ctx, asked } = makeCtx({
      docs,
      answers: [answer(noFixes), answer(noFixes)],
      files: smallFiles(),
    });
    const r = await run(ctx);
    if (r.kind !== "done") throw new Error("debía terminar");
    const scenes = goodScript().scenes.length;
    expect(asked[1]?.images).toHaveLength(scenes * 2);
    expect(asked[1]?.images?.[1]).toMatchObject({ id: "e01-16x9", mime: "image/jpeg" });
    expect(asked[1]?.files["escenas.json"]).toContain("description");
    expect(r.documents[0]?.data).toMatchObject({
      frames: { status: "done", frames: scenes * 2, applied: 0 },
    });
  });

  it("applies a safe fix and leaves a new version of the script", async () => {
    const fix: Review = {
      fixes: [
        {
          scene: 2,
          kind: "imagen",
          problem: "es una foto actual del lugar",
          caption: "El Louvre, foto actual",
        },
      ],
    };
    const { ctx } = makeCtx({ docs, answers: [answer(fix), answer(noFixes)], files: smallFiles() });
    const r = await run(ctx);
    if (r.kind !== "done") throw new Error("debía terminar");
    expect(r.documents.map((d) => d.kind)).toEqual(["review", "script"]);
    const saved = r.documents[1]?.data as { scenes: { caption?: string }[] };
    expect(saved.scenes[1]?.caption).toBe("El Louvre, foto actual");
  });

  it("the frame look fixes what it sees, but never the narration", async () => {
    const original = goodScript().scenes[3]?.narration;
    const seen: Review = {
      fixes: [
        {
          scene: 4,
          kind: "imagen",
          problem: "el recorte deja solo una pared",
          caption: "Detalle de la sala",
          narration: "Una narración que la segunda mirada no puede cambiar nunca.",
        },
      ],
    };
    const { ctx } = makeCtx({
      docs,
      answers: [answer(noFixes), answer(seen)],
      files: smallFiles(),
    });
    const r = await run(ctx);
    if (r.kind !== "done") throw new Error("debía terminar");
    const saved = r.documents[1]?.data as { scenes: { caption?: string; narration: string }[] };
    expect(saved.scenes[3]).toMatchObject({ caption: "Detalle de la sala", narration: original });
    const review = r.documents[0]?.data as { applied: { problem: string }[] };
    expect(review.applied[0]?.problem).toBe("Cuadro: el recorte deja solo una pared");
  });

  it("goes on without the frame look when the frames cannot be drawn", async () => {
    const { ctx, asked } = makeCtx({ docs, answers: [answer(noFixes)], files: smallFiles() });
    const broken = {
      renderStills: async () => {
        throw new Error("sin Chrome");
      },
    };
    const r = await run(ctx, broken);
    if (r.kind !== "done") throw new Error("debía terminar");
    expect(asked).toHaveLength(1);
    expect(r.documents[0]?.data).toMatchObject({ frames: { status: "skipped" } });
  });

  it("does not apply a fix that breaks a rule, and says so in the review", async () => {
    const fix: Review = {
      fixes: [
        {
          scene: 3,
          kind: "numero",
          problem: "cifra mal",
          narration: `${goodScript().scenes[2]!.narration} Fueron 424242.`,
        },
      ],
    };
    const { ctx } = makeCtx({ docs, answers: [answer(fix), answer(noFixes)], files: smallFiles() });
    const r = await run(ctx);
    if (r.kind !== "done") throw new Error("debía terminar");
    expect(r.documents.map((d) => d.kind)).toEqual(["review"]);
    const saved = r.documents[0]?.data as { rejected: unknown[] };
    expect(saved.rejected).toHaveLength(1);
  });

  it("returns Claude's limit, in either look", async () => {
    const limit = failure({ kind: "rate_limited", message: "l", retryAfterMs: null });
    const first = makeCtx({ docs, answers: [limit], files: smallFiles() });
    expect(await run(first.ctx)).toEqual({ kind: "rate_limited", retryAfterMs: null });
    const second = makeCtx({ docs, answers: [answer(noFixes), limit], files: smallFiles() });
    expect(await run(second.ctx)).toEqual({ kind: "rate_limited", retryAfterMs: null });
  });
});
