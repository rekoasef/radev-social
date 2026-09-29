import {
  type AIError,
  buildBrandClaudeMd,
  type GenerationResult,
  type RouteAttempt,
  type Router,
} from "@radev/ai";
import {
  type AiTask,
  type BrandData,
  type BrandDocumentKind,
  type CarouselGenerateJob,
  type DataFigure,
  type DataSeries,
  findFigure,
  type GenerationRequest,
  type PostArt,
  rateLimitDelayMs,
  resolveAiRoute,
  versionDatasets,
} from "@radev/core";
import {
  addGeneratedVersion,
  type Brand,
  chartRefs,
  type Database,
  failGeneration,
  getBrandById,
  getBrandData,
  getPostById,
  getPostVersion,
  getSeriesByKey,
  listAiRoutes,
  listCurrentBrandDocuments,
  listPillars,
  listRecentPostHooks,
  type NewGenerationRun,
  type RecentPost,
  recordGenerationRun,
  setGenerationRetryAt,
} from "@radev/db";
import {
  type AiCarousel,
  aiCarouselSchema,
  aiSlideGuide,
  brandLooks,
  describeRenderProblems,
  isLookId,
  type LookId,
  lookChoices,
  lookTakesArt,
  type StoredRenderIssue,
} from "@radev/slides/generation";
import type { Logger } from "../logger";

// carousel.generate (docs/ARCHITECTURE.md §7, phase 3 T7): writes a post that is `generating`
// with the brand's route (principal, then fallback), records every attempt, and on success stores
// the version and queues its render. Only runs for a post that is still `generating`, so a
// repeated job does nothing (rule 8).

/** Turns for claude -p: the context is in the prompt, so it only answers (structured output). */
const MAX_TURNS = 3;
/** Reschedules after a provider's limit before giving up (15 min … 240 min: about 17 h). */
export const MAX_RATE_LIMIT_ATTEMPTS = 8;

export const GENERATION_PROMPT =
  "Escribí un carrusel para TikTok a partir de `task.json`. Antes leé `slides.md` (qué hace cada tipo de slide) y `recent-posts.json` (no repitas temas ni hooks). Devolvé solo el objeto que pide el schema.";

/** Added to the prompt when the brand has real data (phase 3, T11). */
export const DATA_PROMPT =
  "`data.json` trae datos reales del día: si el tema lo pide, usalos, y son los únicos números que podés mostrar.";

/** Added to the prompt when the brand draws its posts with looks (`studio` preset). */
export const LOOK_PROMPT =
  "Elegí también el `look` del carrusel: la sección Look de `slides.md` dice para qué sirve cada uno.";

/** Added to the prompt when the run rewrites an existing version (phase 3, T8). */
export const REVISION_PROMPT =
  "Es una revisión: `task.json` trae `revision` y `previous.json` es el carrusel anterior. Corregí lo que se pide y mantené lo que funciona.";

/** A regeneration: the post's current version and why it has to change. */
export type Revision = {
  previous: unknown;
  /** The operator's rejection, if the post was rejected. */
  feedback: string | null;
  /** Render QA problems of the previous version (describeRenderProblems). */
  renderProblems: readonly string[];
};

/** The series a post belongs to, as the AI gets it (phase 3, T10). */
export type TaskSeries = { name: string; brief: string; requiredSlides: readonly string[] };

/** The context files of a run, besides the brand's CLAUDE.md. */
export function buildTaskFiles(input: {
  request: GenerationRequest;
  recent: readonly RecentPost[];
  /** Problems of the previous answer, when retrying a malformed one. */
  problems?: readonly string[];
  revision?: Revision;
  series?: TaskSeries;
  /** The brand's real data (`data.json`), when it has data sources. */
  data?: BrandData | null;
  /** The looks the post may take (`studio` brands). */
  looks?: readonly LookId[];
}): Record<string, string> {
  const { request, recent, problems, revision, series, data, looks } = input;
  const task = {
    idea: request.idea,
    ...(series && {
      series: {
        name: series.name,
        structure: series.brief,
        requiredSlides: series.requiredSlides,
        note: "El post es de esta serie: seguí su estructura. Las slides de requiredSlides son obligatorias.",
      },
    }),
    pillarKey: request.pillarKey,
    ...(request.pillarKey === null && {
      pillarNote: "Elegí el pilar de la marca que mejor le quede a la idea.",
    }),
    hookType: request.hookType,
    ...(request.hookType === null && {
      hookNote: "Elegí el tipo de hook que mejor funcione para esta idea.",
    }),
    ...(problems &&
      problems.length > 0 && {
        previousProblems: problems,
        previousProblemsNote:
          "Tu respuesta anterior no cumplía el formato por estos problemas. Corregilos.",
      }),
    ...(revision && {
      revision: {
        previousFile: "previous.json",
        note: "Ya escribiste este carrusel (está en previous.json) y hay que corregirlo. Cambiá lo que se pide abajo y mantené lo que funciona.",
        ...(revision.feedback && {
          operatorFeedback: revision.feedback,
          operatorFeedbackNote:
            "El operador lo rechazó por esto. Es lo más importante: resolvelo aunque haya que cambiar mucho.",
        }),
        ...(revision.renderProblems.length > 0 && {
          renderProblems: revision.renderProblems,
          renderProblemsNote:
            "Estos textos no entran en el diseño de la slide: acortalos o usá otro tipo de slide. Respetá los límites de caracteres del schema.",
        }),
      },
    }),
  };
  return {
    "task.json": `${JSON.stringify(task, null, 2)}\n`,
    "slides.md": aiSlideGuide({ data: Boolean(data), looks }),
    "recent-posts.json": `${JSON.stringify(recent, null, 2)}\n`,
    ...(data && { "data.json": `${JSON.stringify(data, null, 2)}\n` }),
    ...(revision && { "previous.json": `${JSON.stringify(revision.previous, null, 2)}\n` }),
  };
}

/**
 * The source of a data slide is data too (rule 9): a chart gets its dataset's, a bigNumber its
 * figure's, whatever the AI wrote (it tends to add "Fuente:", which the template already puts).
 */
export function stampDataSources(
  carousel: AiCarousel,
  data: { datasets: Readonly<Record<string, DataSeries>>; figures: readonly DataFigure[] },
): AiCarousel {
  const slides = carousel.slides.map((slide) => {
    if (slide.type === "chart") {
      const source = data.datasets[slide.datasetRef]?.source;
      return source ? { ...slide, source } : slide;
    }
    if (slide.type === "bigNumber") {
      const source = findFigure(data.figures, slide.value)?.source;
      return source ? { ...slide, source } : slide;
    }
    return slide;
  });
  return { ...carousel, slides };
}

/**
 * The images of a new version (ADR 0016): pending when its look takes them and the AI described
 * them; skipped, saying why, when there is no image provider. Null when the look takes none.
 */
export function artPlan(content: AiCarousel, canGenerate: boolean): PostArt | null {
  if (!content.art || !lookTakesArt(content.look)) return null;
  return canGenerate
    ? { status: "pending", images: {} }
    : {
        status: "skipped",
        images: {},
        note: "Faltan las credenciales de Cloudflare (CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN).",
      };
}

/** One row of generation_runs from an attempt of the route (a post's, or an idea request's). */
export function runRow(
  attempt: RouteAttempt<unknown>,
  context: { brandId: string; postId: string | null; task?: AiTask },
): NewGenerationRun {
  const { result, target, role } = attempt;
  const usage = result.usage;
  return {
    brandId: context.brandId,
    postId: context.postId,
    task: context.task ?? "carousel.generate",
    role,
    provider: target.provider,
    model: usage?.model ?? target.model,
    status: result.ok ? "succeeded" : "failed",
    errorKind: result.ok ? null : result.error.kind,
    error: result.ok ? null : describeError(result.error),
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    costUsd: usage?.costUsd ?? null,
    durationMs: usage?.durationMs ?? null,
    numTurns: usage?.numTurns ?? null,
    sessionId: usage?.sessionId ?? null,
  };
}

/** The message plus, for a malformed answer, its problems (what the post page shows). */
export const describeError = (error: AIError) =>
  error.kind === "validation"
    ? `${error.message}\n${error.issues.map((issue) => `- ${issue}`).join("\n")}`
    : error.message;

export type Decision =
  | { kind: "save" }
  /** Malformed answer, first time: again with its problems as feedback. */
  | { kind: "retryWithFeedback"; problems: string[] }
  /** Every provider hit its limit: try later. */
  | { kind: "reschedule"; delayMs: number }
  /** Worth another try soon: pg-boss retries the job. */
  | { kind: "retry" }
  | { kind: "fail" };

/** What to do with the route's final result. Pure, so the rules are tested apart. */
export function decide(
  result: GenerationResult<unknown>,
  state: { feedbackUsed: boolean; rateLimitAttempt: number; lastTry: boolean },
): Decision {
  if (result.ok) return { kind: "save" };
  const { error } = result;
  switch (error.kind) {
    case "validation":
      return state.feedbackUsed
        ? { kind: "fail" }
        : { kind: "retryWithFeedback", problems: error.issues };
    case "rate_limited":
      return state.rateLimitAttempt + 1 >= MAX_RATE_LIMIT_ATTEMPTS
        ? { kind: "fail" }
        : {
            kind: "reschedule",
            delayMs: rateLimitDelayMs(state.rateLimitAttempt, error.retryAfterMs),
          };
    case "provider_error":
      return error.retryable && !state.lastTry ? { kind: "retry" } : { kind: "fail" };
  }
}

export type GenerateDeps = {
  db: Database;
  log: Logger;
  router: Router;
  queueRender: (versionId: string) => Promise<void>;
  /** Queues the images of a version (ADR 0016); absent without Cloudflare credentials. */
  queueArt?: (versionId: string) => Promise<void>;
  queueGenerate: (job: CarouselGenerateJob, delayMs: number) => Promise<void>;
  /** The job's last retry by pg-boss: a retryable error fails the post instead. */
  lastTry: boolean;
  /** A provider hit its limit and the post waits until `retryAt` (Telegram, phase 4 T6). */
  onRateLimit?: (input: { postId: string; retryAt: Date }) => Promise<void>;
};

export type GenerateOutcome = "saved" | "rescheduled" | "retry" | "failed" | "skipped";

/** Thrown to let pg-boss retry the job (a provider error worth another try). */
export class RetryableGenerationError extends Error {}

/** The brand's active pillars and its CLAUDE.md, built from the database (rule 7). */
export async function brandContext(db: Database, brand: Brand) {
  const [documents, pillars] = await Promise.all([
    listCurrentBrandDocuments(db, brand.id),
    listPillars(db, brand.id),
  ]);
  const texts: Partial<Record<BrandDocumentKind, string>> = {};
  for (const [kind, document] of Object.entries(documents)) {
    if (document) texts[kind as BrandDocumentKind] = document.content;
  }
  return {
    pillars,
    /** The pricing document (empty without one): the only source of a costBreakdown's ranges. */
    pricing: texts.pricing ?? "",
    claudeMd: buildBrandClaudeMd({
      name: brand.name,
      documents: texts,
      pillars: pillars.map(({ key, name, description, targetShare }) => ({
        key,
        name,
        description,
        targetShare,
      })),
      whatsappNumber: brand.whatsappNumber,
    }),
  };
}

export async function generateCarousel(
  deps: GenerateDeps,
  job: CarouselGenerateJob,
): Promise<GenerateOutcome> {
  const { db, log } = deps;
  const post = await getPostById(db, job.postId);
  if (post?.status !== "generating") {
    log.info("generation skipped: post not generating", {
      postId: job.postId,
      status: post?.status,
    });
    return "skipped";
  }
  const brand = await getBrandById(db, post.brandId);
  const request = post.generationRequest;
  const route = resolveAiRoute(await listAiRoutes(db), "carousel.generate", post.brandId);
  if (!brand || !request || !route) {
    log.error("generation failed: missing brand, request or route", {
      post: post.publicCode,
      brand: Boolean(brand),
      request: Boolean(request),
      route: Boolean(route),
    });
    await failGeneration(db, post.id);
    return "failed";
  }

  const [{ claudeMd, pillars, pricing }, recent, current, seriesRow, data] = await Promise.all([
    brandContext(db, brand),
    listRecentPostHooks(db, brand.id, { exceptPostId: post.id }),
    post.currentVersionId ? getPostVersion(db, post.currentVersionId) : undefined,
    request.seriesKey ? getSeriesByKey(db, brand.id, request.seriesKey) : undefined,
    getBrandData(db, brand.id),
  ]);
  // A studio brand: the AI picks the look among the brand's, minus the last posts' (a revision
  // keeps the one it has).
  const enabled = brandLooks(brand.stylePreset, brand.themeTokens);
  const previousLook = (current?.content as { look?: unknown } | undefined)?.look;
  const looks =
    enabled.length > 0
      ? lookChoices(
          enabled,
          recent.map((r) => r.look),
          typeof previousLook === "string" && isLookId(previousLook) ? previousLook : undefined,
        )
      : undefined;
  const series: TaskSeries | undefined = seriesRow && {
    name: seriesRow.name,
    brief: seriesRow.brief,
    requiredSlides: seriesRow.requiredSlides,
  };
  // A post that already has a version is being regenerated: after a rejection or the render QA.
  const revision: Revision | undefined = current
    ? {
        previous: current.content,
        feedback: post.rejectionFeedback,
        renderProblems: describeRenderProblems(
          Array.isArray(current.renderIssues) ? (current.renderIssues as StoredRenderIssue[]) : [],
        ),
      }
    : undefined;
  const schema = aiCarouselSchema(
    pillars.map((pillar) => pillar.key),
    {
      requiredSlides: series?.requiredSlides,
      pricing,
      data: data
        ? {
            datasets: Object.keys(data.datasets),
            isFigure: (value) => findFigure(data.figures, value) !== undefined,
          }
        : undefined,
      looks,
    },
  );
  const prompt = [
    GENERATION_PROMPT,
    ...(data ? [DATA_PROMPT] : []),
    ...(looks ? [LOOK_PROMPT] : []),
    ...(revision ? [REVISION_PROMPT] : []),
  ].join(" ");
  const context = { brandId: brand.id, postId: post.id };

  let problems: string[] | undefined;
  while (true) {
    const routed = await deps.router.generate<AiCarousel>(route, {
      task: "carousel.generate",
      brandId: brand.id,
      prompt,
      files: {
        "CLAUDE.md": claudeMd,
        ...buildTaskFiles({ request, recent, problems, revision, series, data, looks }),
      },
      schema,
      maxTurns: MAX_TURNS,
    });
    const runIds = [];
    for (const attempt of routed.attempts) {
      runIds.push(await recordGenerationRun(db, runRow(attempt, context)));
    }
    for (const attempt of routed.attempts) {
      log.info("generation attempt", {
        post: post.publicCode,
        role: attempt.role,
        provider: attempt.target.provider,
        model: attempt.result.usage?.model ?? attempt.target.model,
        ok: attempt.result.ok,
        error: attempt.result.ok ? undefined : attempt.result.error.kind,
        durationMs: attempt.result.usage?.durationMs,
      });
    }

    const decision = decide(routed.result, {
      feedbackUsed: problems !== undefined,
      rateLimitAttempt: job.attempt,
      lastTry: deps.lastTry,
    });
    switch (decision.kind) {
      case "save": {
        if (!routed.result.ok) throw new Error("unreachable");
        const winner = routed.attempts.findIndex((attempt) => attempt.result.ok);
        // The charts keep the points the AI was given (or the previous version's, in a revision).
        const refs = chartRefs(routed.result.data);
        const datasets =
          refs.length > 0
            ? versionDatasets({
                refs,
                previous: current?.datasets ?? null,
                current: data?.datasets ?? null,
              }).datasets
            : null;
        const content = data
          ? stampDataSources(routed.result.data, {
              datasets: datasets ?? {},
              figures: data.figures,
            })
          : routed.result.data;
        const art = artPlan(content, Boolean(deps.queueArt));
        const saved = await addGeneratedVersion(db, {
          postId: post.id,
          content,
          art,
          generationRunId: runIds[winner] ?? null,
          datasets,
        });
        if (!saved.ok) {
          log.warn("generated version not saved", { post: post.publicCode, reason: saved.reason });
          return "skipped";
        }
        // A look with images goes through art.generate, which queues the render when it is done.
        if (art?.status === "pending" && deps.queueArt) await deps.queueArt(saved.version.id);
        else await deps.queueRender(saved.version.id);
        return "saved";
      }
      case "retryWithFeedback":
        problems = decision.problems;
        continue;
      case "reschedule": {
        const at = new Date(Date.now() + decision.delayMs);
        await setGenerationRetryAt(db, post.id, at);
        await deps.queueGenerate({ postId: post.id, attempt: job.attempt + 1 }, decision.delayMs);
        await deps.onRateLimit?.({ postId: post.id, retryAt: at });
        log.warn("generation rescheduled: provider limit", {
          post: post.publicCode,
          attempt: job.attempt + 1,
          at: at.toISOString(),
        });
        return "rescheduled";
      }
      case "retry":
        throw new RetryableGenerationError(routed.result.ok ? "" : routed.result.error.message);
      case "fail":
        await failGeneration(db, post.id);
        return "failed";
    }
  }
}
