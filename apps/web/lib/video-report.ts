import type { WorkingStage } from "@radev/core";

// What each office spent on a video, from its AI runs, its usage events and its documents. Pure.

export type ReportRun = {
  task: string;
  status: string;
  inputTokens: number;
  outputTokens: number;
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
  { office: "2 Fuentes", who: "Código", stage: "checking_sources", task: null },
  { office: "3 Imágenes", who: "Claude + Commons", stage: "finding_images", task: "video.images" },
  { office: "4 Guion", who: "Claude", stage: "scripting", task: "video.script" },
  { office: "5 Verificación", who: "Claude", stage: "checking_facts", task: "video.review" },
  { office: "6 Locución", who: "ElevenLabs", stage: "voicing", task: null },
  { office: "7 Render", who: "Remotion", stage: "rendering", task: null },
  { office: "8 Publicación", who: "Claude + código", stage: "packaging", task: "video.package" },
];

const number = new Intl.NumberFormat("es-AR");
const tokens = (input: number, output: number) =>
  `${number.format(input)} / ${number.format(output)}`;
const sum = <T>(list: readonly T[], value: (item: T) => number) =>
  list.reduce((total, item) => total + value(item), 0);

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
          ? tokens(
              sum(runs, (r) => r.inputTokens),
              sum(runs, (r) => r.outputTokens),
            )
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
      spent: tokens(
        sum(input.runs, (r) => r.inputTokens),
        sum(input.runs, (r) => r.outputTokens),
      ),
      ms: measured.length ? sum(measured, (r) => r.ms ?? 0) : null,
      notes: characters ? `+ ${number.format(characters)} créditos de voz` : "",
    },
  };
}
