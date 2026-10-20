import type { Router } from "@radev/ai";
import { type BrandData, findFigure, resolveAiRoute, type SlideRewriteJob } from "@radev/core";
import {
  type Database,
  finishSlideRewrite,
  getBrandById,
  getBrandData,
  listAiRoutes,
  listPostScreenshots,
  recordGenerationRun,
  startSlideRewrite,
} from "@radev/db";
import type { Slide } from "@radev/slides";
import {
  type AiScreenshot,
  aiSlideGuide,
  aiSlideRewriteSchema,
  brandLooks,
  isLookId,
  type LookId,
  rewriteTooSimilar,
} from "@radev/slides/generation";
import type { Logger } from "../logger";
import { brandContext, loadScreenshots, runRow } from "./carousel-generate";
import { decideIdeas } from "./ideas-request";

// slide.rewrite (editor, "Rehacer con IA"): one slide of the carousel the editor had, rewritten
// with the operator's instruction and checked inside the whole carousel. The result is a proposal
// stored on the request: nothing of the post changes until the operator takes it in the editor
// and saves. Only runs a request that is still queued (rule 8).

export const REWRITE_PROMPT =
  "Reescribí solo la slide que indica `task.json` del carrusel de `carousel.json`, siguiendo la instrucción. Leé antes `slides.md`. Mantené el tono de la marca y la coherencia con el resto del carrusel, pero el cambio se tiene que notar: reescribí la slide de verdad, no retoques una o dos palabras. Devolvé solo el objeto que pide el schema: la slide nueva.";

/** Added to the prompt when the post has screenshots (ADR 0024). */
export const REWRITE_SCREENSHOTS_PROMPT =
  "El post tiene capturas de pantalla (las ves en el mensaje y están en `screenshots.json`): una slide `screen` muestra una de ellas, como dice la sección Capturas de `slides.md`.";

const MAX_TURNS = 3;

/** The context files of a rewrite, besides the brand's CLAUDE.md. */
export function buildRewriteFiles(input: {
  carousel: Record<string, unknown>;
  slideIndex: number;
  instruction: string;
  data: BrandData | null;
  problems?: readonly string[];
  /** The post's screenshots (ADR 0024). */
  screenshots?: readonly AiScreenshot[];
  /** The post's look (studio brands): the AI may change the slide's composition within it. */
  look?: LookId;
  /** The previous answer, when it came back practically the same as the current slide. */
  tooSimilar?: unknown;
}): Record<string, string> {
  const { carousel, slideIndex, instruction, data, problems, look, tooSimilar } = input;
  const shots = input.screenshots && input.screenshots.length > 0 ? input.screenshots : undefined;
  const slides = (carousel.slides as unknown[]) ?? [];
  const current = slides[slideIndex] as { type?: string } | undefined;
  const task = {
    slide: slideIndex + 1,
    totalSlides: slides.length,
    currentType: current?.type,
    instruction: instruction || "Mejorala: más clara, más directa y con más gancho.",
    rules: [
      `Podés mantener el tipo de slide, pero si la instrucción pide otro formato, o algo que este tipo no puede mostrar, cambiá al tipo que le corresponde (ver slides.md): afirmación → \`statement\`, pregunta → \`question\`, pasos → \`steps\`, lista u opciones → \`cardGrid\`, comparación → \`comparison\`, proceso → \`flow\`${shots ? ", captura de pantalla → `screen`" : ""}.`,
      "Si la instrucción pide cambiarla entera, hacerla distinta o de nuevo, usá otro tipo de slide (o, si el tipo es el único que sirve, otra composición) y escribí textos nuevos.",
      "Si la instrucción pide más contenido, sumá contenido de verdad (más ítems, un texto de apoyo, un ejemplo concreto). Si el tipo actual no tiene dónde ponerlo (una pregunta o una afirmación tienen solo un título y un texto), pasala a uno que sí (`cardGrid`, `steps`, `comparison`).",
      ...(look
        ? [
            "Si la instrucción dice que la slide se ve mal o pide otro diseño, cambiá también su `composition` (ver Composición en slides.md), no solo los textos.",
          ]
        : []),
      slideIndex === 0
        ? "Es la portada: tiene que seguir siendo `cover`."
        : slideIndex === slides.length - 1
          ? "Es el cierre: tiene que seguir siendo `cta`."
          : "No puede ser `cover` ni `cta` (van primera y última).",
      "No cambies las otras slides: solo devolvés esta.",
    ],
    ...(tooSimilar !== undefined && {
      previousAnswer: stripLayout(tooSimilar),
      previousAnswerNote:
        "Tu respuesta anterior (previousAnswer) era casi igual a la slide actual: el operador no va a notar el cambio. Volvé a hacerla con un cambio claro. Solo si la instrucción pide un ajuste puntual (una palabra, un dato), está bien que el resto quede igual.",
    }),
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
    "slides.md": aiSlideGuide({ data: Boolean(data), screenshots: shots, rewriteLook: look }),
    ...(data && { "data.json": `${JSON.stringify(data, null, 2)}\n` }),
    ...(shots && { "screenshots.json": `${JSON.stringify(shots, null, 2)}\n` }),
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

  const [{ claudeMd, pillars, pricing }, data, rows] = await Promise.all([
    brandContext(db, brand),
    getBrandData(db, brand.id),
    // Screenshots belong to a post (none in a new one) and only the studio preset draws them.
    request.postId && brandLooks(brand.stylePreset, brand.themeTokens).length > 0
      ? listPostScreenshots(db, request.postId)
      : [],
  ]);
  const { images, screenshots, missing } = await loadScreenshots(rows);
  if (missing.length > 0) {
    log.warn("screenshots missing on disk", { requestId: request.id, missing });
  }
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
        screenshots,
      },
    ],
  );

  // The look the post has (studio brands): lets the AI change the slide's composition.
  const look =
    typeof request.carousel.look === "string" &&
    isLookId(request.carousel.look) &&
    brandLooks(brand.stylePreset, brand.themeTokens).includes(request.carousel.look)
      ? request.carousel.look
      : undefined;
  const current = slides[request.slideIndex];

  let problems: string[] | undefined;
  // A valid answer that came back practically the same: asked once more, and kept if that fails.
  let tooSimilar: Record<string, unknown> | undefined;
  const save = async (slide: Record<string, unknown>) => {
    await finishSlideRewrite(db, request.id, { result: slide });
    log.info("slide rewrite done", { requestId: request.id });
    return "done" as const;
  };
  while (true) {
    const routed = await deps.router.generate<{ slide: Slide }>(route, {
      task: "slide.rewrite",
      brandId: brand.id,
      prompt:
        screenshots.length > 0 ? `${REWRITE_PROMPT} ${REWRITE_SCREENSHOTS_PROMPT}` : REWRITE_PROMPT,
      files: {
        "CLAUDE.md": claudeMd,
        ...buildRewriteFiles({
          carousel: request.carousel,
          slideIndex: request.slideIndex,
          instruction: request.instruction,
          data,
          problems,
          screenshots,
          look,
          tooSimilar,
        }),
      },
      images,
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
        const slide = routed.result.data.slide as unknown as Record<string, unknown>;
        if (tooSimilar === undefined && rewriteTooSimilar(current, slide)) {
          log.info("slide rewrite too similar, asking again", { requestId: request.id });
          tooSimilar = slide;
          problems = undefined;
          continue;
        }
        return save(slide);
      }
      case "retryWithFeedback":
        problems = decision.problems;
        continue;
      case "retry":
        if (tooSimilar) return save(tooSimilar);
        throw new RetryableRewriteError(routed.result.ok ? "" : routed.result.error.message);
      case "fail":
        if (tooSimilar) return save(tooSimilar);
        return fail(decision.message);
    }
  }
}
