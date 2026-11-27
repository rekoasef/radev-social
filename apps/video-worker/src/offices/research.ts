import { checkDossier, type Dossier, dossierSchema, RESEARCH_RULES } from "@radev/video";
import type { AiAnswer } from "../ai";
import { failedAi, type Office, OfficeFailure } from "../office";

// Oficina 1, Investigación: `claude -p` con búsqueda web arma el dossier (hechos con fuente). Si no
// pasa los controles (datos de prueba, pocos sitios…), se le pide una vez que lo corrija con el dossier
// anterior a la vista: rehacer la búsqueda entera costaba lo mismo que la primera vez. Si no cumplía
// el formato no hay dossier que corregir y se pide de nuevo (V0-13).

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

const list = (problems: string[]) => problems.map((p) => `- ${p}`).join("\n");

export const research: Office = async (ctx) => {
  let problems: string[] = [];
  /** The dossier the checks rejected, for the AI to fix instead of starting over. */
  let previous: Dossier | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    await ctx.progress({ attempt, attempts: 2, problems });
    const answer: AiAnswer<Dossier> = await ctx.ai.run(ctx.video, {
      task: "video.research",
      prompt:
        attempt === 1
          ? "Investigá el tema de `task.json` y devolvé el dossier."
          : previous
            ? `Tu dossier anterior (\`anterior.json\`) no pasó estos controles:\n${list(problems)}\nCorregí solo eso: buscá lo que falta y devolvé el dossier COMPLETO, manteniendo lo que estaba bien. No rehagas la investigación entera.`
            : `Tu respuesta anterior no cumplía el formato:\n${list(problems)}\nInvestigá el tema de \`task.json\` y devolvé el dossier.`,
      files: {
        "CLAUDE.md": RESEARCH_RULES,
        "task.json": TASK(ctx.video.topic, ctx.video.language),
        ...(previous ? { "anterior.json": JSON.stringify(previous) } : {}),
      },
      schema: dossierSchema,
      tools: ["WebSearch", "WebFetch"],
      effort: "low",
      // a fix needs a few searches, not the whole investigation
      maxTurns: previous ? 20 : 40,
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
    previous = answer.data;
    await ctx.ai.reject(answer.runId, problems);
    ctx.log.warn("dossier rejected by the checks", { attempt, problems });
  }
  throw new OfficeFailure(`El dossier no pasó los controles: ${problems.join(" | ")}`);
};
