import { checkDossier, dossierSchema, RESEARCH_RULES } from "@radev/video";
import { failedAi, type Office, OfficeFailure } from "../office";

// Oficina 1, Investigación: `claude -p` con búsqueda web arma el dossier (hechos con fuente). Si sale
// con datos de prueba o no cumple el formato, se pide una vez más desde cero (V0-13).

const TASK = (topic: string, language: string) =>
  JSON.stringify(
    {
      tema: topic,
      idioma: language,
      para:
        "Video de 1,5–2,5 min (15–22 escenas): hace falta material para contar la historia entera, " +
        "no solo el hecho: antecedentes y protagonistas, la preparación, el hecho paso a paso, cómo " +
        "se descubrió o investigó, qué pasó después y el dato final que sorprende. Apuntá a 20–30 " +
        "hechos y todas las citas textuales que encuentres.",
    },
    null,
    1,
  );

export const research: Office = async (ctx) => {
  let problems: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    await ctx.progress({ attempt, attempts: 2, problems });
    const answer = await ctx.ai.run(ctx.video, {
      task: "video.research",
      prompt:
        attempt === 1
          ? "Investigá el tema de `task.json` y devolvé el dossier."
          : `Tu dossier anterior tuvo estos problemas; investigá de nuevo desde cero y devolvé uno bueno:\n${problems.map((p) => `- ${p}`).join("\n")}`,
      files: {
        "CLAUDE.md": RESEARCH_RULES,
        "task.json": TASK(ctx.video.topic, ctx.video.language),
      },
      schema: dossierSchema,
      tools: ["WebSearch", "WebFetch"],
      effort: "low",
      maxTurns: 40,
      timeoutMs: 15 * 60_000,
    });
    if (!answer.ok) {
      if (answer.error.kind === "validation" && attempt < 2) {
        problems = answer.error.issues;
        continue;
      }
      return failedAi(answer.error, "La investigación");
    }
    problems = checkDossier(answer.data);
    if (problems.length === 0) {
      return {
        kind: "done",
        documents: [
          { kind: "dossier", data: answer.data, origin: "office", generationRunId: answer.runId },
        ],
      };
    }
    await ctx.ai.reject(answer.runId, problems);
    ctx.log.warn("dossier rejected by the checks", { attempt, problems });
  }
  throw new OfficeFailure(`El dossier no pasó los controles: ${problems.join(" | ")}`);
};
