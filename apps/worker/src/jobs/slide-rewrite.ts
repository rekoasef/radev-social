import type { Router } from "@radev/ai";
import { type BrandData, findFigure, resolveAiRoute, type SlideRewriteJob } from "@radev/core";
import {
  type Database,
  finishSlideRewrite,
  getBrandById,
  getBrandData,
  listAiRoutes,
  recordGenerationRun,
  startSlideRewrite,
} from "@radev/db";
import type { Slide } from "@radev/slides";
import { aiSlideGuide, aiSlideRewriteSchema } from "@radev/slides/generation";
import type { Logger } from "../logger";
import { brandContext, runRow } from "./carousel-generate";
import { decideIdeas } from "./ideas-request";

// slide.rewrite (editor, "Rehacer con IA"): one slide of the carousel the editor had, rewritten
// with the operator's instruction and checked inside the whole carousel. The result is a proposal
// stored on the request: nothing of the post changes until the operator takes it in the editor
// and saves. Only runs a request that is still queued (rule 8).

export const REWRITE_PROMPT =
  "Reescribí solo la slide que indica `task.json` del carrusel de `carousel.json`, siguiendo la instrucción. Leé antes `slides.md`. Mantené el tono y la coherencia con el resto del carrusel. Devolvé solo el objeto que pide el schema: la slide nueva.";

const MAX_TURNS = 3;

/** The context files of a rewrite, besides the brand's CLAUDE.md. */
export function buildRewriteFiles(input: {
  carousel: Record<string, unknown>;
  slideIndex: number;
  instruction: string;
  data: BrandData | null;
  problems?: readonly string[];
}): Record<string, string> {
  const { carousel, slideIndex, instruction, data, problems } = input;
  const slides = (carousel.slides as unknown[]) ?? [];
  const current = slides[slideIndex] as { type?: string } | undefined;
  const task = {
    slide: slideIndex + 1,
    totalSlides: slides.length,
    currentType: current?.type,
    instruction: instruction || "Mejorala: más clara, más directa y con más gancho.",
    rules: [
      "Por defecto mantené el tipo de slide. Si la instrucción pide otro formato, cambiá al tipo que le corresponde (ver slides.md): afirmación → `statement`, pregunta → `question`, pasos → `steps`, lista u opciones → `cardGrid`, comparación → `comparison`, proceso → `flow`.",
      slideIndex === 0
        ? "Es la portada: tiene que seguir siendo `cover`."
        : slideIndex === slides.length - 1
          ? "Es el cierre: tiene que seguir siendo `cta`."
          : "No puede ser `cover` ni `cta` (van primera y última).",
      "No cambies las otras slides: solo devolvés esta.",
    ],
    ...(problems &&
      problems.length > 0 && {
        previousProblems: problems,
        previousProblemsNote:
          "Tu respuesta anterior no cumplía el formato por estos problemas. Corregilos.",
      }),
  };
  // The layout of the slide being rewritten is the operator's hand adjustment: not the AI's.
  const shown = { ...carousel, slides: slides.map((s) => stripLayout(s)) };
  return {
    "task.json": `${JSON.stringify(task, null, 2)}\n`,
    "carousel.json": `${JSON.stringify(shown, null, 2)}\n`,
    "slides.md": aiSlideGuide({ data: Boolean(data) }),
    ...(data && { "data.json": `${JSON.stringify(data, null, 2)}\n` }),
  };
}

const stripLayout = (slide: unknown) => {
  if (!slide || typeof slide !== "object") return slide;
  const { layout: _layout, ...rest } = slide as Record<string, unknown>;
  return rest;
};

export type RewriteDeps = {
  db: Database;
  log: Logger;
  router: Router;
  /** The job's last retry by pg-boss: a retryable error fails the request instead. */
  lastTry: boolean;
};

export type RewriteOutcome = "done" | "failed" | "skipped";

/** Thrown to let pg-boss retry the job (a provider error worth another try). */
export class RetryableRewriteError extends Error {}

export async function rewriteSlide(
  deps: RewriteDeps,
  job: SlideRewriteJob,
): Promise<RewriteOutcome> {
  const { db, log } = deps;
  const request = await startSlideRewrite(db, job.requestId);
  if (!request) {
    log.info("slide rewrite skipped: not queued", { requestId: job.requestId });
    return "skipped";
  }
  const fail = async (error: string) => {
    await finishSlideRewrite(db, request.id, { error });
    log.warn("slide rewrite failed", { requestId: request.id, error });
    return "failed" as const;
  };

  const brand = await getBrandById(db, request.brandId);
  if (!brand || brand.archivedAt) return fail("La marca no existe o está archivada.");
  const route = resolveAiRoute(await listAiRoutes(db), "slide.rewrite", brand.id);
  if (!route) return fail("No hay una ruta de IA para slide.rewrite (Ajustes → Ruteo de IA).");
  const slides = request.carousel.slides;
  if (!Array.isArray(slides) || !slides[request.slideIndex]) return fail("Esa slide no existe.");

  const [{ claudeMd, pillars, pricing }, data] = await Promise.all([
    brandContext(db, brand),
    getBrandData(db, brand.id),
  ]);
  const schema = aiSlideRewriteSchema(
    request.carousel as { slides: unknown[] },
    request.slideIndex,
    [
      pillars.map((p) => p.key),
      {
        pricing,
        data: data
          ? {
              datasets: Object.keys(data.datasets),
              isFigure: (value: string) => findFigure(data.figures, value) !== undefined,
            }
          : undefined,
      },
    ],
  );

  let problems: string[] | undefined;
  while (true) {
    const routed = await deps.router.generate<{ slide: Slide }>(route, {
      task: "slide.rewrite",
      brandId: brand.id,
      prompt: REWRITE_PROMPT,
      files: {
        "CLAUDE.md": claudeMd,
        ...buildRewriteFiles({
          carousel: request.carousel,
          slideIndex: request.slideIndex,
          instruction: request.instruction,
          data,
          problems,
        }),
      },
      schema,
      maxTurns: MAX_TURNS,
    });
    for (const attempt of routed.attempts) {
      await recordGenerationRun(
        db,
        runRow(attempt, { brandId: brand.id, postId: request.postId, task: "slide.rewrite" }),
      );
      log.info("slide rewrite attempt", {
        requestId: request.id,
        role: attempt.role,
        provider: attempt.target.provider,
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
        await finishSlideRewrite(db, request.id, {
          result: routed.result.data.slide as unknown as Record<string, unknown>,
        });
        log.info("slide rewrite done", { requestId: request.id });
        return "done";
      }
      case "retryWithFeedback":
        problems = decision.problems;
        continue;
      case "retry":
        throw new RetryableRewriteError(routed.result.ok ? "" : routed.result.error.message);
      case "fail":
        return fail(decision.message);
    }
  }
}
