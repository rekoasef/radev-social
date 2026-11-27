import type { WorkingStage } from "@radev/core";
import { apiUsd } from "./api-cost";

// What each office spent on a video, from its AI runs, its usage events and its documents. Pure.
// Claude's runs show their API-equivalent cost, not their tokens (see api-cost.ts).

export type ReportRun = {
  task: string;
  status: string;
  inputTokens: number;
  outputTokens: number;
  /** API-equivalent cost, as claude -p reports it (null for providers that do not). */
  costUsd: number | null;
  durationMs: number | null;
};

export type ReportUsage = {
  kind: string;
  office: string | null;
  quantity: number;
  durationMs: number | null;
};

export type ReportRow = {
  office: string;
  who: string;
  spent: string;
  /** Null when it was not measured (videos made before the offices recorded it). */
  ms: number | null;
  notes: string;
};

const OFFICES: { office: string; who: string; stage: WorkingStage; task: string | null }[] = [
  { office: "1 Investigación", who: "Claude", stage: "researching", task: "video.research" },
  { office: "2 Fuentes", who: "Código + Claude", stage: "checking_sources", task: "video.sources" },
  { office: "3 Imágenes", who: "Claude + Commons", stage: "finding_images", task: "video.images" },
  { office: "4 Guion", who: "Claude", stage: "scripting", task: "video.script" },
  { office: "5 Verificación", who: "Claude", stage: "checking_facts", task: "video.review" },
  { office: "6 Locución", who: "ElevenLabs", stage: "voicing", task: null },
  { office: "7 Render", who: "Remotion", stage: "rendering", task: null },
  { office: "8 Publicación", who: "Claude + código", stage: "packaging", task: "video.package" },
];

const number = new Intl.NumberFormat("es-AR");
const sum = <T>(list: readonly T[], value: (item: T) => number) =>
  list.reduce((total, item) => total + value(item), 0);
/** The runs' API-equivalent cost; null when none of them reported it. */
const cost = (runs: readonly ReportRun[]) =>
  runs.some((r) => r.costUsd != null) ? sum(runs, (r) => r.costUsd ?? 0) : null;

export function videoReport(input: {
  runs: readonly ReportRun[];
  usage: readonly ReportUsage[];
  notes: Partial<Record<WorkingStage, string>>;
}): { rows: ReportRow[]; total: ReportRow } {
  const characters = sum(
    input.usage.filter((u) => u.kind === "tts"),
    (u) => u.quantity,
  );
  const rows = OFFICES.map(({ office, who, stage, task }) => {
    const runs = task ? input.runs.filter((r) => r.task === task) : [];
    const times = input.usage.filter((u) => u.kind === "office" && u.office === stage);
    const failed = runs.filter((r) => r.status !== "succeeded").length;
    const spent =
      stage === "voicing" && characters
        ? `${number.format(characters)} créditos`
        : runs.length
          ? apiUsd(cost(runs))
          : "—";
    return {
      office,
      who,
      spent,
      ms: times.length ? sum(times, (u) => u.durationMs ?? 0) : null,
      notes: [
        input.notes[stage],
        runs.length > 1 ? `${runs.length} corridas` : null,
        failed ? `${failed} con error` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });
  const measured = rows.filter((r) => r.ms !== null);
  return {
    rows,
    total: {
      office: "Total",
      who: `${input.runs.length} corridas de Claude`,
      spent: apiUsd(cost(input.runs)),
      ms: measured.length ? sum(measured, (r) => r.ms ?? 0) : null,
      notes: characters ? `+ ${number.format(characters)} créditos de voz` : "",
    },
  };
}
