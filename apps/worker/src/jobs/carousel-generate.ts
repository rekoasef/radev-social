import {
  type AIError,
  buildBrandClaudeMd,
  type GenerationResult,
  type RouteAttempt,
  type Router,
} from "@radev/ai";
import {
  type BrandDocumentKind,
  type CarouselGenerateJob,
  type GenerationRequest,
  rateLimitDelayMs,
  resolveAiRoute,
} from "@radev/core";
import {
  addGeneratedVersion,
  type Brand,
  type Database,
  failGeneration,
  getBrandById,
  getPostById,
  getPostVersion,
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
  AI_SLIDE_GUIDE,
  type AiCarousel,
  aiCarouselSchema,
  describeRenderProblems,
  type StoredRenderIssue,
} from "@radev/slides/generation";
import type { Logger } from "../logger";

// carousel.generate (docs/ARCHITECTURE.md §7, phase 3 T7): writes a post that is `generating`
// with the brand's route (principal, then fallback), records every attempt, and on success stores
// the version and queues its render. Only runs for a post that is still `generating`, so a
// repeated job does nothing (rule 8).

/** Turns for claude -p: read task.json, slides.md and recent-posts.json, then answer. */
const MAX_TURNS = 8;
/** Reschedules after a provider's limit before giving up (15 min … 240 min: about 17 h). */
export const MAX_RATE_LIMIT_ATTEMPTS = 8;

export const GENERATION_PROMPT =
  "Escribí un carrusel para TikTok a partir de `task.json`. Antes leé `slides.md` (qué hace cada tipo de slide) y `recent-posts.json` (no repitas temas ni hooks). Devolvé solo el objeto que pide el schema.";

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

/** The context files of a run, besides the brand's CLAUDE.md. */
export function buildTaskFiles(input: {
  request: GenerationRequest;
  recent: readonly RecentPost[];
  /** Problems of the previous answer, when retrying a malformed one. */
  problems?: readonly string[];
  revision?: Revision;
}): Record<string, string> {
  const { request, recent, problems, revision } = input;
  const task = {
    idea: request.idea,
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
    "slides.md": AI_SLIDE_GUIDE,
    "recent-posts.json": `${JSON.stringify(recent, null, 2)}\n`,
    ...(revision && { "previous.json": `${JSON.stringify(revision.previous, null, 2)}\n` }),
  };
}

/** One row of generation_runs from an attempt of the route. */
export function runRow(
  attempt: RouteAttempt<unknown>,
  context: { brandId: string; postId: string },
): NewGenerationRun {
  const { result, target, role } = attempt;
  const usage = result.usage;
  return {
    brandId: context.brandId,
    postId: context.postId,
    task: "carousel.generate",
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
const describeError = (error: AIError) =>
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
  queueGenerate: (job: CarouselGenerateJob, delayMs: number) => Promise<void>;
  /** The job's last retry by pg-boss: a retryable error fails the post instead. */
  lastTry: boolean;
};

export type GenerateOutcome = "saved" | "rescheduled" | "retry" | "failed" | "skipped";

/** Thrown to let pg-boss retry the job (a provider error worth another try). */
export class RetryableGenerationError extends Error {}

async function brandContext(db: Database, brand: Brand) {
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

  const [{ claudeMd, pillars }, recent, current] = await Promise.all([
    brandContext(db, brand),
    listRecentPostHooks(db, brand.id, { exceptPostId: post.id }),
    post.currentVersionId ? getPostVersion(db, post.currentVersionId) : undefined,
  ]);
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
  const schema = aiCarouselSchema(pillars.map((pillar) => pillar.key));
  const context = { brandId: brand.id, postId: post.id };

  let problems: string[] | undefined;
  while (true) {
    const routed = await deps.router.generate<AiCarousel>(route, {
      task: "carousel.generate",
      brandId: brand.id,
      prompt: revision ? `${GENERATION_PROMPT} ${REVISION_PROMPT}` : GENERATION_PROMPT,
      files: {
        "CLAUDE.md": claudeMd,
        ...buildTaskFiles({ request, recent, problems, revision }),
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
        const saved = await addGeneratedVersion(db, {
          postId: post.id,
          content: routed.result.data,
          generationRunId: runIds[winner] ?? null,
        });
        if (!saved.ok) {
          log.warn("generated version not saved", { post: post.publicCode, reason: saved.reason });
          return "skipped";
        }
        await deps.queueRender(saved.version.id);
        return "saved";
      }
      case "retryWithFeedback":
        problems = decision.problems;
        continue;
      case "reschedule": {
        const at = new Date(Date.now() + decision.delayMs);
        await setGenerationRetryAt(db, post.id, at);
        await deps.queueGenerate({ postId: post.id, attempt: job.attempt + 1 }, decision.delayMs);
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
