import type { TaskImage } from "@radev/ai";
import {
  applyFixes,
  compactDossier,
  dossierSchema,
  dropNameCards,
  type Fix,
  FRAME_RULES,
  type ImageCandidate,
  imagesDocSchema,
  REVIEW_RULES,
  type RejectedFix,
  reviewSchema,
  reviewView,
  type Script,
  scriptSchema,
  smallImagePath,
} from "@radev/video";
import { drawFrames } from "../frames";
import { failedAi, type Office, type OfficeContext, type OfficeResult } from "../office";
import type { VideoRenderer } from "../remotion";
import { readDocument } from "./util";

// Oficina 5, Verificación de hechos. Dos miradas:
// 1. Una IA revisa el guion contra el dossier (texto, y las imágenes enteras).
// 2. El código dibuja el cuadro de cada escena como va a salir (recorte, carteles, pie) y una IA los
//    mira: lo que la primera no puede ver (docs/VIDEO-CALIDAD.md). Corrige imagen, pie, encuadre o
//    gráficos, nunca la narración.
// El código aplica solo las correcciones que no rompen ninguna regla; si cambia algo, el guion
// corregido es una versión nueva (la anterior queda guardada).

export type ReviewDeps = { renderer: Pick<VideoRenderer, "renderStills"> };

/** How the second look went, for the desk. */
export type FrameCheck =
  | { status: "done"; frames: number; applied: number }
  | { status: "skipped"; reason: string };

export const createReviewOffice =
  (deps: ReviewDeps): Office =>
  async (ctx) => {
    const dossier = await readDocument(ctx, "dossier", dossierSchema);
    const script = await readDocument(ctx, "script", scriptSchema);
    const { candidates } = await readDocument(ctx, "images", imagesDocSchema);
    const { text, json } = compactDossier(dossier);

    const images: TaskImage[] = [];
    for (const id of new Set(script.scenes.map((s) => s.image))) {
      const c = candidates.find((x) => x.id === id);
      const data = c ? await ctx.files.read(smallImagePath(id)) : undefined;
      if (c && data)
        images.push({ id, note: `${c.title} (${c.width}x${c.height})`, mime: "image/jpeg", data });
    }

    await ctx.progress({ detail: "Verificando los hechos" });
    const answer = await ctx.ai.run(ctx.video, {
      task: "video.review",
      prompt: "Verificá `guion.json` contra `dossier.json` y devolvé las correcciones.",
      files: {
        "CLAUDE.md": REVIEW_RULES,
        "dossier.json": json,
        "guion.json": JSON.stringify(reviewView(script, candidates)),
        "candidatas.json": JSON.stringify(
          candidates.map((c) => ({
            id: c.id,
            title: c.title,
            // whole: who is who in a photo is often at the end
            description: c.description,
            date: c.date,
          })),
        ),
      },
      images,
      schema: reviewSchema,
      effort: "medium",
      maxTurns: 5,
      timeoutMs: 8 * 60_000,
    });
    if (!answer.ok) return failedAi(answer.error, "La verificación de hechos");

    const result = applyFixes(script, answer.data.fixes, candidates, text);
    // A correction can change an image: its name cards have to hold up too.
    const checked = dropNameCards(result.script, candidates);
    if (checked.dropped.length)
      ctx.log.warn("name cards the image does not back", { dropped: checked.dropped });

    const second = await lookAtFrames(ctx, deps, checked.script, candidates, text);
    if ("kind" in second) return second;
    ctx.log.info("facts checked", {
      proposed: answer.data.fixes.length,
      applied: result.applied.length,
      rejected: result.rejected.length,
      frames: second.check,
    });

    const final = second.script;
    const changed =
      result.applied.length > 0 || checked.dropped.length > 0 || second.applied.length > 0;
    const documents: Extract<OfficeResult, { kind: "done" }>["documents"] = [
      {
        kind: "review",
        data: {
          applied: [...result.applied, ...second.applied],
          rejected: [...result.rejected, ...second.rejected],
          frames: second.check,
        },
        origin: "office",
        generationRunId: answer.runId,
      },
    ];
    if (changed) {
      documents.push({
        kind: "script",
        data: final,
        origin: "office",
        generationRunId: answer.runId,
      });
    }
    return { kind: "done", documents, title: final.title };
  };

type SecondLook = {
  script: Script;
  applied: Fix[];
  rejected: RejectedFix[];
  check: FrameCheck;
};

/** The frames, the AI that looks at them, and the frames again for what it changed. */
export async function lookAtFrames(
  ctx: OfficeContext,
  deps: ReviewDeps,
  script: Script,
  candidates: ImageCandidate[],
  dossierText: string,
): Promise<SecondLook | OfficeResult> {
  const skipped = (reason: string): SecondLook => {
    ctx.log.warn("frames not checked", { reason });
    return { script, applied: [], rejected: [], check: { status: "skipped", reason } };
  };
  const framesDeps = {
    renderer: deps.renderer,
    exists: async (path: string) => (await ctx.files.read(path)) !== undefined,
    mediaDir: ctx.mediaDir,
  };

  await ctx.progress({ detail: "Dibujando los cuadros" });
  let frames: Awaited<ReturnType<typeof drawFrames>>["frames"];
  try {
    frames = (await drawFrames(framesDeps, script, candidates)).frames;
  } catch (error) {
    return skipped(`No se pudieron dibujar los cuadros: ${String(error).slice(0, 200)}`);
  }

  const images: TaskImage[] = [];
  for (const frame of frames) {
    const n = String(frame.scene).padStart(2, "0");
    for (const [format, label] of [
      ["9x16", "Short (vertical)"],
      ["16x9", "video normal (horizontal)"],
    ] as const) {
      const data = await ctx.files.read(frame.files[format]);
      if (data) {
        images.push({
          id: `e${n}-${format}`,
          note: `Escena ${frame.scene}, ${label}`,
          mime: "image/jpeg",
          data,
        });
      }
    }
  }
  if (images.length === 0) return skipped("No quedó ningún cuadro dibujado.");

  await ctx.progress({ detail: "Mirando los cuadros" });
  const answer = await ctx.ai.run(ctx.video, {
    task: "video.review",
    prompt:
      "Mirá el cuadro de cada escena, en los dos formatos, con `escenas.json` y `candidatas.json`, y devolvé las correcciones.",
    files: {
      "CLAUDE.md": FRAME_RULES,
      "escenas.json": JSON.stringify(
        script.scenes.map((s, i) => {
          const c = candidates.find((x) => x.id === s.image);
          return {
            scene: i + 1,
            narration: s.narration,
            image: c && { id: c.id, title: c.title, description: c.description, date: c.date },
            exact: s.exact,
            caption: s.caption,
            whole: s.whole,
            graphics: s.graphics,
          };
        }),
      ),
      "candidatas.json": JSON.stringify(
        candidates.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          date: c.date,
          size: `${c.width}x${c.height}`,
        })),
      ),
    },
    images,
    schema: reviewSchema,
    effort: "medium",
    maxTurns: 3,
    timeoutMs: 8 * 60_000,
  });
  if (!answer.ok) {
    // Claude's limit pauses the video as always; any other trouble leaves the frames unchecked
    // (the operator still sees them on the desk).
    if (answer.error.kind === "rate_limited")
      return failedAi(answer.error, "La revisión de cuadros");
    return skipped(`La revisión de los cuadros falló: ${answer.error.message.slice(0, 200)}`);
  }

  // Never the narration: it would cost the voice and is the first look's job.
  const fixes = answer.data.fixes.map(({ narration: _, cita: __, ...fix }) => ({
    ...fix,
    problem: `Cuadro: ${fix.problem}`,
  }));
  const result = applyFixes(script, fixes, candidates, dossierText);
  const { script: fixed } = dropNameCards(result.script, candidates);
  if (result.applied.length > 0) {
    // the desk shows the frames of the script it gets
    await drawFrames(framesDeps, fixed, candidates).catch((error) =>
      ctx.log.warn("changed frames not drawn", { error: String(error) }),
    );
  }
  return {
    script: fixed,
    applied: result.applied,
    rejected: result.rejected,
    check: { status: "done", frames: images.length, applied: result.applied.length },
  };
}
