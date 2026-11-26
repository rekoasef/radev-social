import type { TaskImage } from "@radev/ai";
import {
  applyFixes,
  compactDossier,
  dossierSchema,
  dropNameCards,
  imagesDocSchema,
  REVIEW_RULES,
  reviewSchema,
  reviewView,
  scriptSchema,
  smallImagePath,
} from "@radev/video";
import { failedAi, type Office } from "../office";
import { readDocument } from "./util";

// Oficina 5, Verificación de hechos: una segunda IA, que también mira las imágenes, revisa el guion
// contra el dossier. El código solo aplica las correcciones que no rompen ninguna regla; si cambia
// algo, el guion corregido es una versión nueva (la anterior queda guardada).

export const review: Office = async (ctx) => {
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
  const { script: checked, dropped } = dropNameCards(result.script, candidates);
  if (dropped.length) ctx.log.warn("name cards the image does not back", { dropped });
  ctx.log.info("facts checked", {
    proposed: answer.data.fixes.length,
    applied: result.applied.length,
    rejected: result.rejected.length,
  });
  const documents: Extract<Awaited<ReturnType<Office>>, { kind: "done" }>["documents"] = [
    {
      kind: "review",
      data: { applied: result.applied, rejected: result.rejected },
      origin: "office",
      generationRunId: answer.runId,
    },
  ];
  if (result.applied.length > 0 || dropped.length > 0) {
    documents.push({
      kind: "script",
      data: checked,
      origin: "office",
      generationRunId: answer.runId,
    });
  }
  return { kind: "done", documents, title: checked.title };
};
