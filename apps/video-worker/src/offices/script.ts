import type { TaskImage } from "@radev/ai";
import {
  aiScriptSchema,
  checkScript,
  compactDossier,
  dossierSchema,
  dropNameCards,
  imagesDocSchema,
  normalizeHighlights,
  SCRIPT_RULES,
  type Script,
  smallImagePath,
} from "@radev/video";
import { failedAi, type Office, OfficeFailure } from "../office";
import { readDocument } from "./util";

// Oficina 4, Guion: la IA mira las imágenes y escribe el guion solo con el dossier. El código lo
// controla (números del dossier, palabras de enganche, variedad…) y le pide hasta 4 veces que
// corrija. Después de un rechazo del operador recibe su nota y el guion anterior.

const MAX_ATTEMPTS = 4;

export const script: Office = async (ctx) => {
  const dossier = await readDocument(ctx, "dossier", dossierSchema);
  const { candidates } = await readDocument(ctx, "images", imagesDocSchema);
  const { text, json } = compactDossier(dossier);
  const brief = JSON.stringify(
    candidates.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      date: c.date,
      author: c.author,
      license: c.license,
      size: `${c.width}x${c.height}`,
    })),
  );
  const images: TaskImage[] = [];
  for (const c of candidates) {
    const data = await ctx.files.read(smallImagePath(c.id));
    if (data) {
      images.push({
        id: c.id,
        note: `${c.title} (${c.date || "s/f"}), ${c.width}x${c.height}`,
        mime: "image/jpeg",
        data,
      });
    }
  }

  // After a rejection: the operator's note and the script he rejected.
  const rejected = ctx.video.rejectionNote
    ? ((await ctx.document("script")) as Script | null)
    : null;
  const rejection = ctx.video.rejectionNote && rejected ? ctx.video.rejectionNote : null;

  let previous: Script | undefined = rejection ? (rejected ?? undefined) : undefined;
  let problems: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const first = attempt === 1;
    await ctx.progress({ attempt, attempts: MAX_ATTEMPTS, problems });
    const answer = await ctx.ai.run(ctx.video, {
      task: "video.script",
      prompt: first
        ? `Escribí el guion del video con \`dossier.json\`, \`candidatas.json\` y las imágenes. Devolvé el objeto que pide el schema.${
            rejection
              ? ` El operador rechazó el guion anterior (\`anterior.json\`) y pidió esto: «${rejection}». Reescribilo resolviendo eso y manteniendo lo que estaba bien.`
              : ""
          }`
        : `El guion anterior (\`anterior.json\`) tiene estos errores. Devolvé el guion COMPLETO corregido, cambiando lo mínimo:\n${problems.map((p) => `- ${p}`).join("\n")}`,
      files: {
        "CLAUDE.md": SCRIPT_RULES,
        "dossier.json": json,
        "candidatas.json": brief,
        ...(previous ? { "anterior.json": JSON.stringify(previous) } : {}),
      },
      // the images go only the first time: the corrections are text
      ...(first ? { images } : {}),
      schema: aiScriptSchema,
      effort: "low",
      maxTurns: 3,
      timeoutMs: 10 * 60_000,
    });
    if (!answer.ok) {
      if (answer.error.kind === "validation") {
        problems = answer.error.issues;
        continue;
      }
      return failedAi(answer.error, "El guion");
    }
    const draft = normalizeHighlights(answer.data);
    problems = checkScript(draft, candidates, text);
    if (problems.length === 0) {
      const { script: clean, dropped } = dropNameCards(draft, candidates);
      if (dropped.length) ctx.log.warn("name cards the image does not back", { dropped });
      return {
        kind: "done",
        title: clean.title,
        documents: [
          { kind: "script", data: clean, origin: "office", generationRunId: answer.runId },
        ],
      };
    }
    previous = draft;
    await ctx.ai.reject(answer.runId, problems);
    ctx.log.warn("script rejected by the checks", { attempt, problems: problems.length });
  }
  throw new OfficeFailure(
    `El guion no pasó los controles en ${MAX_ATTEMPTS} intentos: ${problems.slice(0, 5).join(" | ")}`,
  );
};
