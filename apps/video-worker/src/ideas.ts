import { dropRepeatedIdeas, type GenerationResult, type Router } from "@radev/ai";
import {
  type AiRoute,
  resolveAiRoute,
  VIDEO_IDEA_COUNT,
  VIDEO_IDEA_TASK,
  type VideoIdea,
  type VideoIdeasJob,
} from "@radev/core";
import type { VideoIdeaRequest, VideoIdeaUsage } from "@radev/db";
import { IDEA_PROMPT, IDEA_RESEARCH_PROMPT, IDEA_RULES, videoIdeasSchema } from "@radev/video";
import type { AiLock } from "./ai-lock";
import type { Logger } from "./logger";

// "Proponer ideas" and "Investigar temas" of a new video (docs/ARCHITECTURE.md §14.1). Not an
// office: there is no video yet. The request row holds what was asked and the answer, closed by one
// update, so running the job twice changes nothing (rule 8).

export type IdeasDeps = {
  start(requestId: string): Promise<VideoIdeaRequest | undefined>;
  finish(
    requestId: string,
    outcome: ({ ideas: VideoIdea[] } | { error: string }) & VideoIdeaUsage,
  ): Promise<void>;
  routes(): Promise<AiRoute[]>;
  router: Pick<Router, "generate">;
  lock: AiLock;
  /** The brand's voice and pillars, or null for a video without a brand. */
  brandNotes(brandId: string): Promise<string | null>;
  /** Topics and titles already made or proposed, newest first. */
  existing(): Promise<string[]>;
  log: Pick<Logger, "info" | "warn">;
};

const SETTINGS = {
  generate: { prompt: IDEA_PROMPT, tools: undefined, maxTurns: 3, timeoutMs: 5 * 60_000 },
  research: {
    prompt: IDEA_RESEARCH_PROMPT,
    tools: ["WebSearch", "WebFetch"],
    maxTurns: 30,
    timeoutMs: 10 * 60_000,
  },
} as const;

export type IdeasOutcome = "skipped" | "succeeded" | "failed";

export async function proposeIdeas(deps: IdeasDeps, job: VideoIdeasJob): Promise<IdeasOutcome> {
  const request = await deps.start(job.requestId);
  if (!request) return "skipped";

  const usage: VideoIdeaUsage = { model: null, inputTokens: 0, outputTokens: 0, durationMs: null };
  const fail = async (error: string): Promise<IdeasOutcome> => {
    deps.log.warn("ideas failed", { requestId: request.id, error });
    await deps.finish(request.id, { ...usage, error: error.slice(0, 1000) });
    return "failed";
  };

  const task = VIDEO_IDEA_TASK[request.mode];
  const route = resolveAiRoute(await deps.routes(), task, request.brandId ?? "");
  if (!route) {
    return fail(`No hay una ruta de IA para ${task}. Corré pnpm db:seed.`);
  }
  const [brand, existing] = await Promise.all([
    request.brandId ? deps.brandNotes(request.brandId) : null,
    deps.existing(),
  ]);
  const settings = SETTINGS[request.mode];
  const brief = {
    cantidad: VIDEO_IDEA_COUNT,
    enfoque: request.focus ?? "Libre: historias reales que sorprendan.",
    canal: brand
      ? "El canal de la marca descripta en `marca.md`: temas que le sirvan a su público, sin vender nada."
      : "Canal de historias reales.",
  };

  let problems: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const routed = await deps.lock.run(() =>
      deps.router.generate(route, {
        task,
        brandId: request.brandId ?? "video-ideas",
        prompt:
          attempt === 1
            ? settings.prompt
            : `${settings.prompt}\nTu respuesta anterior no cumplía el formato:\n${problems.map((p) => `- ${p}`).join("\n")}`,
        files: {
          "CLAUDE.md": IDEA_RULES,
          "task.json": JSON.stringify(brief, null, 1),
          "ya-hechos.json": JSON.stringify(existing, null, 1),
          ...(brand && { "marca.md": brand }),
        },
        schema: videoIdeasSchema(request.mode),
        tools: settings.tools,
        effort: "low",
        maxTurns: settings.maxTurns,
        timeoutMs: settings.timeoutMs,
      }),
    );
    for (const { result, target } of routed.attempts) addUsage(usage, result, target.model);

    if (!routed.result.ok) {
      const { error } = routed.result;
      if (error.kind === "validation" && attempt < 2) {
        problems = error.issues;
        continue;
      }
      return fail(error.message);
    }
    const proposed = routed.result.data.ideas.map((idea) => ({
      title: idea.topic,
      topic: idea.topic,
      hook: idea.hook,
      sources: "sources" in idea ? (idea.sources as VideoIdea["sources"]) : [],
    }));
    const ideas = dropRepeatedIdeas(proposed, existing).map(({ title: _, ...idea }) => idea);
    if (ideas.length === 0) return fail("La IA solo propuso temas que ya tenés. Probá de nuevo.");
    await deps.finish(request.id, { ...usage, ideas });
    deps.log.info("ideas proposed", { requestId: request.id, count: ideas.length, ...usage });
    return "succeeded";
  }
  return fail("La respuesta de la IA no cumplió el formato.");
}

function addUsage(total: VideoIdeaUsage, result: GenerationResult<unknown>, model: string): void {
  const { usage } = result;
  total.model = usage?.model ?? model;
  total.inputTokens += usage?.inputTokens ?? 0;
  total.outputTokens += usage?.outputTokens ?? 0;
  if (usage?.durationMs != null) total.durationMs = (total.durationMs ?? 0) + usage.durationMs;
}
