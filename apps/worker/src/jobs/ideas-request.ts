import {
  dropRepeatedIdeas,
  type GenerationResult,
  type IdeaProposal,
  type IdeaProposals,
  ideaProposalsSchema,
  type Router,
} from "@radev/ai";
import {
  type IdeaRequestJob,
  type IdeaRequestParams,
  type IdeaRequestTask,
  type IdeaSource,
  resolveAiRoute,
} from "@radev/core";
import {
  completeIdeaRequest,
  type Database,
  failIdeaRequest,
  getBrandById,
  listActiveSeries,
  listAiRoutes,
  listIdeaTitles,
  listRecentPostHooks,
  type ProposedIdea,
  type RecentPost,
  recordGenerationRun,
  type SeriesSummary,
  startIdeaRequest,
} from "@radev/db";
import type { Logger } from "../logger";
import { brandContext, describeError, runRow } from "./carousel-generate";

// ideas.generate and ideas.research (docs/ARCHITECTURE.md §6 and §7, phase 3 T10): the AI proposes
// ideas for the brand's bank from its pillars, series and history; the research looks into the
// niche with web search first. The request row holds the parameters; its ideas are stored in the
// same transaction that closes it, so a repeated job adds nothing (rule 8).

export const IDEAS_PROMPT =
  "Proponé ideas para carruseles de la marca a partir de `task.json`. Leé `series.md`, `recent-posts.json` y `existing-ideas.json`: no repitas temas que ya estén. Devolvé solo el objeto que pide el schema.";

export const RESEARCH_PROMPT =
  "Investigá con búsqueda web qué se está hablando ahora en el nicho de la marca y traé ideas para carruseles según `task.json`. Leé antes `series.md`, `recent-posts.json` y `existing-ideas.json`: no repitas temas que ya estén. Cada idea lleva las páginas en las que se basa. Devolvé solo el objeto que pide el schema.";

const RUN_SETTINGS: Record<
  IdeaRequestTask,
  { prompt: string; tools?: string[]; maxTurns: number; timeoutMs?: number }
> = {
  "ideas.generate": { prompt: IDEAS_PROMPT, maxTurns: 6 },
  "ideas.research": {
    prompt: RESEARCH_PROMPT,
    tools: ["WebSearch", "WebFetch"],
    maxTurns: 30,
    timeoutMs: 10 * 60_000,
  },
};

type ExistingIdea = { title: string; status: string; seriesKey: string | null };

/** The context files of a request, besides the brand's CLAUDE.md. */
export function buildIdeaFiles(input: {
  task: IdeaRequestTask;
  params: IdeaRequestParams;
  series: readonly Pick<SeriesSummary, "key" | "name" | "brief" | "pillarKey">[];
  recent: readonly RecentPost[];
  existing: readonly ExistingIdea[];
  /** Problems of the previous answer, when retrying a malformed one. */
  problems?: readonly string[];
}): Record<string, string> {
  const { task, params, series, recent, existing, problems } = input;
  const brief = {
    count: params.count,
    countNote: `Hasta ${params.count} ideas distintas entre sí.`,
    pillarKey: params.pillarKey,
    pillarNote: params.pillarKey
      ? "Todas las ideas son de este pilar."
      : "Repartí las ideas entre los pilares según su porcentaje (están en CLAUDE.md).",
    seriesKey: params.seriesKey,
    seriesNote: params.seriesKey
      ? "Todas las ideas son de esta serie (está en series.md): cada una, un tema distinto dentro de la serie."
      : series.length > 0
        ? "Una idea puede ser de una serie de series.md (poné su seriesKey) o suelta (seriesKey null)."
        : "La marca no tiene series: seriesKey va en null.",
    ...(task === "ideas.research" && {
      focus: params.focus,
      focusNote: params.focus
        ? "Enfocá la búsqueda en esto."
        : "Buscá lo que le importa hoy al público de la marca (CLAUDE.md).",
      sourcesNote:
        "Cada idea lleva de 1 a 3 fuentes (título y link) que hayas leído. Nada de páginas inventadas.",
    }),
    rules: [
      "Una idea es un tema con un ángulo concreto, no un carrusel escrito.",
      "`title`: la idea en una frase. `angle`: desde dónde contarla, para quién (puede ir vacío).",
      "Sin porcentajes, montos ni cifras en el título o el ángulo: los números del post salen de los datos de la marca.",
      "Respetá las reglas de CLAUDE.md: nada de temas prohibidos ni casos o precios que no estén ahí.",
    ],
    ...(problems &&
      problems.length > 0 && {
        previousProblems: problems,
        previousProblemsNote:
          "Tu respuesta anterior no cumplía el formato por estos problemas. Corregilos.",
      }),
  };
  const seriesMd =
    series.length === 0
      ? "# Series\n\nLa marca no tiene series.\n"
      : `# Series\n\n${series
          .map(
            (s) =>
              `## ${s.name} (\`${s.key}\`)\n\n${s.pillarKey ? `Pilar: \`${s.pillarKey}\`.\n\n` : ""}${s.brief}`,
          )
          .join("\n\n")}\n`;
  return {
    "task.json": `${JSON.stringify(brief, null, 2)}\n`,
    "series.md": seriesMd,
    "recent-posts.json": `${JSON.stringify(recent, null, 2)}\n`,
    "existing-ideas.json": `${JSON.stringify(existing, null, 2)}\n`,
  };
}

/** Where an idea came from, for the bank. */
export function ideaSource(task: IdeaRequestTask, seriesKey: string | null): IdeaSource {
  if (task === "ideas.research") return "research";
  return seriesKey ? "series" : "ai";
}

/** The rows to store from a valid answer: without repeats, with the pillars' ids. */
export function toProposedIdeas(
  task: IdeaRequestTask,
  answer: IdeaProposals,
  pillarIds: ReadonlyMap<string, string>,
  existingTitles: readonly string[],
): ProposedIdea[] {
  return dropRepeatedIdeas(answer.ideas as IdeaProposal[], existingTitles).map((idea) => ({
    title: idea.title,
    angle: idea.angle,
    pillarId: pillarIds.get(idea.pillarKey) ?? null,
    seriesKey: idea.seriesKey,
    source: ideaSource(task, idea.seriesKey),
    sources: idea.sources ?? [],
  }));
}

export type IdeaDecision =
  | { kind: "save" }
  | { kind: "retryWithFeedback"; problems: string[] }
  /** Worth another try soon: pg-boss retries the job. */
  | { kind: "retry" }
  | { kind: "fail"; message: string };

/**
 * What to do with the route's result. A request is manual: at a provider's limit it fails with a
 * message instead of waiting hours (the operator asks again later).
 */
export function decideIdeas(
  result: GenerationResult<unknown>,
  state: { feedbackUsed: boolean; lastTry: boolean },
): IdeaDecision {
  if (result.ok) return { kind: "save" };
  const { error } = result;
  switch (error.kind) {
    case "validation":
      return state.feedbackUsed
        ? { kind: "fail", message: describeError(error) }
        : { kind: "retryWithFeedback", problems: error.issues };
    case "rate_limited":
      return {
        kind: "fail",
        message: "Se alcanzó el límite del proveedor de IA. Probá de nuevo más tarde.",
      };
    case "provider_error":
      return error.retryable && !state.lastTry
        ? { kind: "retry" }
        : { kind: "fail", message: error.message };
  }
}

export type IdeasDeps = {
  db: Database;
  log: Logger;
  router: Router;
  /** The job's last retry by pg-boss: a retryable error fails the request instead. */
  lastTry: boolean;
};

export type IdeasOutcome = "saved" | "retry" | "failed" | "skipped";

/** Thrown to let pg-boss retry the job (a provider error worth another try). */
export class RetryableIdeasError extends Error {}

export async function runIdeaRequest(deps: IdeasDeps, job: IdeaRequestJob): Promise<IdeasOutcome> {
  const { db, log } = deps;
  const request = await startIdeaRequest(db, job.requestId);
  if (!request) {
    log.info("idea request skipped: already closed", { requestId: job.requestId });
    return "skipped";
  }
  const fail = async (message: string) => {
    await failIdeaRequest(db, request.id, message);
    log.warn("idea request failed", { requestId: request.id, task: request.task, message });
    return "failed" as const;
  };

  const brand = await getBrandById(db, request.brandId);
  if (!brand || brand.archivedAt) return fail("La marca no existe o está archivada.");
  const route = resolveAiRoute(await listAiRoutes(db), request.task, brand.id);
  if (!route) return fail(`No hay una ruta de IA para ${request.task} (Ajustes → Ruteo de IA).`);

  const [{ claudeMd, pillars }, activeSeries, recent, existing] = await Promise.all([
    brandContext(db, brand),
    listActiveSeries(db, brand.id),
    listRecentPostHooks(db, brand.id),
    listIdeaTitles(db, brand.id),
  ]);
  const { params, task } = request;
  const series = params.seriesKey
    ? activeSeries.filter((s) => s.key === params.seriesKey)
    : activeSeries;
  if (params.seriesKey && series.length === 0) return fail("Esa serie no existe o está archivada.");
  // A series with a pillar keeps its ideas there unless the request fixes another one.
  const fixedPillar =
    params.pillarKey ?? (params.seriesKey ? (series[0]?.pillarKey ?? null) : null);
  const pillarKeys = fixedPillar
    ? pillars.filter((p) => p.key === fixedPillar).map((p) => p.key)
    : pillars.map((p) => p.key);
  if (pillarKeys.length === 0) return fail("La marca no tiene ese pilar activo.");

  const schema = ideaProposalsSchema({
    pillarKeys,
    seriesKeys: series.map((s) => s.key),
    seriesRequired: params.seriesKey !== null,
    count: params.count,
    research: task === "ideas.research",
  });
  const settings = RUN_SETTINGS[task];

  let problems: string[] | undefined;
  while (true) {
    const routed = await deps.router.generate<IdeaProposals>(route, {
      task,
      brandId: brand.id,
      prompt: settings.prompt,
      files: {
        "CLAUDE.md": claudeMd,
        ...buildIdeaFiles({
          task,
          params: { ...params, pillarKey: fixedPillar },
          series,
          recent,
          existing,
          problems,
        }),
      },
      schema,
      tools: settings.tools,
      maxTurns: settings.maxTurns,
      timeoutMs: settings.timeoutMs,
    });
    for (const attempt of routed.attempts) {
      await recordGenerationRun(db, runRow(attempt, { brandId: brand.id, postId: null, task }));
      log.info("idea request attempt", {
        requestId: request.id,
        task,
        role: attempt.role,
        provider: attempt.target.provider,
        model: attempt.result.usage?.model ?? attempt.target.model,
        ok: attempt.result.ok,
        error: attempt.result.ok ? undefined : attempt.result.error.kind,
        durationMs: attempt.result.usage?.durationMs,
      });
    }

    const decision = decideIdeas(routed.result, {
      feedbackUsed: problems !== undefined,
      lastTry: deps.lastTry,
    });
    switch (decision.kind) {
      case "save": {
        if (!routed.result.ok) throw new Error("unreachable");
        const proposed = toProposedIdeas(
          task,
          routed.result.data,
          new Map(pillars.map((p) => [p.key, p.id])),
          existing.map((idea) => idea.title),
        );
        const stored = await completeIdeaRequest(db, request, proposed);
        log.info("idea request done", { requestId: request.id, task, ideas: stored });
        return "saved";
      }
      case "retryWithFeedback":
        problems = decision.problems;
        continue;
      case "retry":
        throw new RetryableIdeasError(routed.result.ok ? "" : routed.result.error.message);
      case "fail":
        return fail(decision.message);
    }
  }
}
