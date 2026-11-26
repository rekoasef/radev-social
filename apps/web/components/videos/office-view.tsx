import type { WorkingStage } from "@radev/core";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { elapsed } from "@/lib/video-display";
import type { OfficeRoom } from "@/lib/video-floor";
import { OFFICE_INFO, type OfficeView } from "@/lib/video-office";
import { Defs, FolderShape } from "./floor/props";
import { OFFICE_NAME, Office } from "./floor/rooms";
import { FolderTab } from "./folder-tab";

const number = new Intl.NumberFormat("es-AR");

/** An office from inside. Pure: the page gives it the data and the action of a stopped video. */
export function OfficeInside({
  stage,
  room,
  view,
  folder,
  model,
  when,
  action,
}: {
  stage: WorkingStage;
  /** The same room as on the floor plan. */
  room: OfficeRoom;
  view: OfficeView;
  folder?: { code: string; color: number };
  model: string | null;
  when: (at: Date) => string;
  action?: React.ReactNode;
}) {
  const info = OFFICE_INFO[stage];
  const { n, name } = OFFICE_NAME[stage];
  const { current, report } = view;
  const specs: [string, string][] = [
    ...(model
      ? [["Modelo", `${model}${info.effort ? ` · esfuerzo ${info.effort}` : ""}`] as const]
      : []),
    ["Límites", info.limits] as const,
    ["Lee", info.reads] as const,
    ["Deja", info.leaves] as const,
  ].map(([a, b]) => [a, b]);
  const figures: [string, string][] = [
    ["Corridas", String(report.runs)],
    ["Fallas", String(report.failed)],
    ["Devueltos", String(report.returns)],
    ["Tiempo medio", report.averageMs === null ? "—" : elapsed(report.averageMs)],
    ...(report.tokens
      ? [
          [
            "Tokens",
            `${number.format(report.tokens.input)} / ${number.format(report.tokens.output)}`,
          ] as [string, string],
        ]
      : []),
    ...(report.characters !== null
      ? [["Créditos de voz", number.format(report.characters)] as [string, string]]
      : []),
    ["En cola", view.queued ? String(view.queued) : "Nada"],
  ];

  return (
    <div className="flex flex-col gap-10">
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div className="floor">
          <svg viewBox="0 0 520 380" width="100%" aria-labelledby="room-title">
            <title id="room-title">{`La oficina de ${name}: ${room.status}`}</title>
            <Defs p="one" />
            <Office
              stage={stage}
              room={room}
              b={{ x: 6, y: 6, w: 508, h: 368 }}
              p="one"
              phone={false}
              k={2}
              doors={[["bottom", 0.5]]}
              sign={false}
            />
            {folder && room.mode !== "idle" && (
              // On the desk, which is drawn twice as large as on the plan.
              <g
                transform={`translate(${6 + 508 * 0.46 - 56} ${6 + 368 * 0.64 - 4}) rotate(-12) scale(2)`}
              >
                <FolderShape code={folder.code} color={`var(--folder-${folder.color})`} p="one" />
              </g>
            )}
          </svg>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Plate as="h1" aside={info.who}>
            {n} {name}
          </Plate>
          <p className="max-w-[62ch] text-sm text-ink-dim">{info.does}</p>

          <section aria-label="Ahora" className="desk-panel flex flex-col gap-3">
            {current ? (
              <>
                <div className="flex items-start gap-3">
                  {folder && <FolderTab {...folder} />}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/videos/${current.video.id}`}
                      className="-my-1 block py-3 text-sm font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {current.video.title ?? current.video.topic}
                    </Link>
                    {current.video.title && (
                      <p className="truncate text-xs text-ink-faint">{current.video.topic}</p>
                    )}
                  </div>
                  <span className="timecode text-2xl text-ink">{current.time}</span>
                </div>
                <Tally state={current.tally}>{current.status}</Tally>
                {current.attempt !== null && current.attempts !== null && (
                  <div className="flex gap-1.5" aria-hidden="true">
                    {Array.from({ length: current.attempts }, (_, i) => (
                      <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: the tries, in order
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${
                          i + 1 < (current.attempt ?? 0)
                            ? "bg-tally-red/70"
                            : i + 1 === current.attempt
                              ? "bg-ink"
                              : "bg-bezel"
                        }`}
                      />
                    ))}
                  </div>
                )}
                {current.problems.length > 0 && (
                  <div className="text-[13px] text-ink-dim">
                    <p>El intento anterior no pasó los controles:</p>
                    <ol className="mt-1.5 list-decimal rounded-md border border-bezel bg-console py-2 pr-3 pl-8">
                      {current.problems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {action}
              </>
            ) : (
              <>
                <Tally state="off">Libre</Tally>
                <p className="text-sm text-ink-dim">Nada en cola.</p>
              </>
            )}
          </section>

          <dl className="divide-y divide-bezel border-y border-bezel">
            {specs.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[7.5rem_1fr] gap-3 py-2.5 text-sm">
                <dt className="plate-text text-ink-faint">{label}</dt>
                <dd className="min-w-0 break-words text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="history-heading" className="flex flex-col gap-4">
          <Plate id="history-heading" aside="Últimos 7 días">
            Historial
          </Plate>
          {view.history.length === 0 ? (
            <p className="rounded-md border border-dashed border-bezel px-5 py-8 text-sm text-ink-dim">
              Sin movimientos en los últimos 7 días.
            </p>
          ) : (
            <ul className="divide-y divide-bezel rounded-md border border-bezel bg-panel">
              {view.history.map((row) => (
                <li key={row.key} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="timecode text-xs text-ink-faint">{when(row.at)}</span>
                    <Link
                      href={`/videos/${row.videoId}`}
                      className="min-w-0 truncate text-sm text-ink hover:underline max-sm:order-first max-sm:-my-2 max-sm:w-full max-sm:py-3 sm:flex-1"
                    >
                      {row.video}
                    </Link>
                    <Tally state={row.tally}>{row.result}</Tally>
                    <span className="timecode text-xs text-ink-dim">
                      {row.tokens &&
                        `${number.format(row.tokens.input)} / ${number.format(row.tokens.output)} · `}
                      {row.ms === null ? "—" : elapsed(row.ms)}
                    </span>
                  </div>
                  {row.detail.length > 0 && (
                    <details className="text-[13px] text-ink-dim">
                      <summary className="cursor-pointer text-ink-faint">Ver por qué</summary>
                      <ul className="mt-1 list-disc pl-5">
                        {row.detail.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="office-report-heading" className="flex flex-col gap-4">
          <Plate id="office-report-heading">Informe</Plate>
          <dl className="divide-y divide-bezel border-y border-bezel">
            {figures.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 py-2.5 text-sm">
                <dt className="plate-text text-ink-faint">{label}</dt>
                <dd className="timecode text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
