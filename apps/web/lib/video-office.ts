import { currentProgress, type WorkingStage } from "@radev/core";
import type { OfficeHistory } from "@radev/db";
import { operatorError } from "@radev/video";
import type { TallyState } from "@/components/console/tally";
import { type DisplayVideo, describeVideo } from "./video-display";

// What an office shows from inside: who works there, what it does and its limits (they mirror
// docs/ARCHITECTURE.md §14.1), the video on its desk, its history and its report. Pure.

export const OFFICE_SLUG: Record<WorkingStage, string> = {
  researching: "research",
  checking_sources: "sources",
  finding_images: "images",
  scripting: "script",
  checking_facts: "review",
  voicing: "voice",
  rendering: "render",
  packaging: "package",
};

export const stageOfSlug = (slug: string): WorkingStage | null =>
  (Object.keys(OFFICE_SLUG) as WorkingStage[]).find((stage) => OFFICE_SLUG[stage] === slug) ?? null;

export type OfficeInfo = {
  who: string;
  task:
    | "video.research"
    | "video.images"
    | "video.script"
    | "video.review"
    | "video.package"
    | null;
  does: string;
  effort: string | null;
  limits: string;
  reads: string;
  leaves: string;
};

export const OFFICE_INFO: Record<WorkingStage, OfficeInfo> = {
  researching: {
    who: "Claude",
    task: "video.research",
    does: "Investiga el tema en la web y arma el dossier: hechos con su fuente, citas, lo que está en disputa y lo que no pudo confirmar.",
    effort: "low",
    limits: "2 intentos · 15 min cada uno · 40 turnos",
    reads: "tu tema",
    leaves: "dossier → Fuentes",
  },
  checking_sources: {
    who: "Código",
    task: null,
    does: "Baja cada página del dossier y mide si el fragmento citado y sus números están de verdad ahí. Es informativa: no frena nada.",
    effort: null,
    limits: "20 s por página",
    reads: "dossier",
    leaves: "fuentes → Imágenes",
  },
  finding_images: {
    who: "Claude + Commons",
    task: "video.images",
    does: "Propone búsquedas, junta resultados de Wikimedia Commons con licencia libre, elige las mejores y las baja.",
    effort: "low",
    limits: "1 intento por paso · 5 min",
    reads: "dossier",
    leaves: "hoja de imágenes → Guion",
  },
  scripting: {
    who: "Claude",
    task: "video.script",
    does: "Escribe el guion mirando las imágenes. Si no pasa los controles, lo intenta de nuevo con la lista de problemas.",
    effort: "low",
    limits: "4 intentos · 10 min cada uno",
    reads: "dossier · imágenes · tu nota si lo devolviste",
    leaves: "guion → Verificación",
  },
  checking_facts: {
    who: "Claude",
    task: "video.review",
    does: "Una segunda lectura del guion contra el dossier. El código solo aplica las correcciones que no rompen ninguna regla.",
    effort: "medium",
    limits: "1 intento · 8 min",
    reads: "dossier · guion · imágenes",
    leaves: "correcciones → tu escritorio",
  },
  voicing: {
    who: "ElevenLabs",
    task: null,
    does: "Graba toda la narración en una sola toma y la corta por escena. Si el texto y la voz no cambiaron, reutiliza la grabación.",
    effort: null,
    limits: "1 pedido",
    reads: "guion aprobado",
    leaves: "voz → Render",
  },
  rendering: {
    who: "Remotion",
    task: null,
    does: "Arma el video entero en los dos formatos y controla el largo, las medidas y el peso.",
    effort: null,
    limits: "unos 4 min por formato",
    reads: "guion · imágenes · voz",
    leaves: "videos → Publicación",
  },
  packaging: {
    who: "Claude + código",
    task: "video.package",
    does: "Propone título, gancho, capítulos y miniatura; el código arma las descripciones, los créditos y las miniaturas.",
    effort: "low",
    limits: "3 intentos · 6 min cada uno",
    reads: "guion · dossier · voz",
    leaves: "paquete → tu escritorio",
  },
};

export type OfficeVideo = DisplayVideo & { id: string; title: string | null; topic: string };

export type HistoryRow = {
  key: string;
  at: Date;
  videoId: string;
  video: string;
  tally: TallyState;
  result: string;
  tokens: { input: number; output: number } | null;
  ms: number | null;
  /** Why it did not pass, or the operator's note. */
  detail: string[];
};

export type OfficeView = {
  current: {
    video: OfficeVideo;
    tally: TallyState;
    status: string;
    time: string;
    attempt: number | null;
    attempts: number | null;
    problems: string[];
  } | null;
  /** Other videos waiting for this office. */
  queued: number;
  history: HistoryRow[];
  report: {
    runs: number;
    failed: number;
    returns: number;
    averageMs: number | null;
    tokens: { input: number; output: number } | null;
    characters: number | null;
  };
};

const OUTCOME: Record<string, { tally: TallyState; result: string }> = {
  done: { tally: "ready", result: "Terminada" },
  failed: { tally: "fail", result: "Falló" },
  pause: { tally: "timed", result: "Pausada" },
  rate_limited: { tally: "timed", result: "Límite de Claude" },
};

export function officeView(input: {
  stage: WorkingStage;
  videos: readonly OfficeVideo[];
  history: OfficeHistory;
  now: Date;
  timeZone: string;
}): OfficeView {
  const { stage, history, now, timeZone } = input;
  const name = (v: { title: string | null; topic: string }) => v.title ?? v.topic;

  // The one on the desk: with a problem first, then the one being worked on.
  const here = input.videos
    .filter((v) => v.stage === stage)
    .map((video) => ({ video, view: describeVideo(video, now, timeZone) }));
  const first =
    here.find((v) => v.view.tally === "fail") ??
    here.find((v) => v.view.working) ??
    here[0] ??
    null;
  const progress = first ? currentProgress(first.video.progress, stage) : null;

  const runs: HistoryRow[] = history.runs.map((run) => {
    const rejected = run.checkProblems?.length ? run.checkProblems : null;
    const failed = run.status !== "succeeded";
    return {
      key: run.id,
      at: run.createdAt,
      videoId: run.videoId ?? "",
      video: name(run),
      tally: failed ? "fail" : rejected ? "cued" : "ready",
      result: failed ? "Con error" : rejected ? `No pasó · ${rejected.length}` : "Aceptada",
      tokens: { input: run.inputTokens, output: run.outputTokens },
      ms: run.durationMs,
      detail: failed && run.error ? [run.error] : (rejected ?? []).map(operatorError),
    };
  });
  const events: HistoryRow[] = history.events.flatMap((event): HistoryRow[] => {
    const base = {
      key: event.id,
      at: event.createdAt,
      videoId: event.videoId,
      video: name(event),
      tokens: null,
    };
    if (event.kind === "return") {
      const note = typeof event.data?.note === "string" ? [event.data.note] : [];
      return [
        { ...base, tally: "cued" as const, result: "Devuelto por vos", ms: null, detail: note },
      ];
    }
    // The AI offices already show each attempt: their whole runs would repeat it.
    if (event.kind !== "office" || OFFICE_INFO[stage].task) return [];
    const outcome = OUTCOME[String(event.data?.outcome)] ?? OUTCOME.done;
    return [
      { ...base, ...(outcome as (typeof OUTCOME)[string]), ms: event.durationMs, detail: [] },
    ];
  });
  const rows = [...runs, ...events].sort((a, b) => b.at.getTime() - a.at.getTime());

  const officeRuns = history.events.filter((e) => e.kind === "office");
  const timed = officeRuns.filter((e) => e.durationMs !== null);
  const voice = history.events.filter((e) => e.kind === "tts");
  const total = (list: readonly number[]) => list.reduce((a, b) => a + b, 0);

  return {
    current: first && {
      video: first.video,
      tally: first.view.tally,
      status: first.view.status,
      time: first.view.time,
      attempt: progress?.attempt ?? null,
      attempts: progress?.attempts ?? null,
      problems: (progress?.problems ?? []).map(operatorError),
    },
    queued: here.filter((v) => v !== first).length,
    history: rows,
    report: {
      runs: OFFICE_INFO[stage].task ? history.runs.length : officeRuns.length,
      failed: officeRuns.filter((e) => e.data?.outcome === "failed").length,
      returns: history.events.filter((e) => e.kind === "return").length,
      averageMs: timed.length ? total(timed.map((e) => e.durationMs ?? 0)) / timed.length : null,
      tokens: OFFICE_INFO[stage].task
        ? {
            input: total(history.runs.map((r) => r.inputTokens)),
            output: total(history.runs.map((r) => r.outputTokens)),
          }
        : null,
      characters: stage === "voicing" ? total(voice.map((e) => e.quantity)) : null,
    },
  };
}
