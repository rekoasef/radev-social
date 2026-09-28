import {
  canRetryJob,
  GENERATION_WINDOW_KEY,
  isJobName,
  isJobViewTab,
  JOB_LABELS,
  JOB_VIEW_TAB_LABELS,
  JOB_VIEW_TABS,
  type JobViewTab,
  jobError,
  jobTarget,
  parseGenerationWindow,
} from "@radev/core";
import { countJobs, getSetting, type JobRow, listJobs, loadJobTargets } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { Tally, type TallyState } from "@/components/console/tally";
import { db } from "@/lib/db";
import { describeTarget, retryContext, targetIds, targetPost } from "@/lib/job-targets";
import { formatDateTime } from "@/lib/time";
import { retryJobAction } from "./actions";

export const metadata: Metadata = { title: "Cola de trabajos · RAdev Social" };

const LIMIT = 50;

const STATE_DISPLAY: Record<JobRow["state"], { tally: TallyState; label: string }> = {
  created: { tally: "standby", label: "En cola" },
  retry: { tally: "cued", label: "Por reintentar" },
  active: { tally: "cued", label: "Corriendo" },
  completed: { tally: "ready", label: "Hecho" },
  cancelled: { tally: "off", label: "Cancelado" },
  failed: { tally: "live", label: "Falló" },
};

const ERRORS: Record<string, string> = {
  missing: "Ese trabajo ya no existe (pg-boss borra los viejos).",
  cannot: "Ese trabajo ya no se puede reintentar: lo que tenía que hacer cambió.",
  retry: "pg-boss no lo volvió a encolar. Probá de nuevo en un rato.",
};

// The worker's queue (pg-boss), for when something does not move: what waits, what runs, what
// failed and why (phase 4, T8). Read-only but for "Reintentar" on failed jobs that make sense.
export default async function JobsPage({ searchParams }: PageProps<"/settings/jobs">) {
  const query = await searchParams;
  const tab: JobViewTab = isJobViewTab(query.tab) ? query.tab : "pending";
  const now = new Date();
  const [counts, jobs, storedWindow] = await Promise.all([
    countJobs(db, now),
    listJobs(db, { states: JOB_VIEW_TABS[tab], limit: LIMIT }),
    getSetting(db, GENERATION_WINDOW_KEY),
  ]);
  // Times in the operator's zone: the one of the generation window (Settings).
  const zone = parseGenerationWindow(storedWindow).timeZone;
  const rows = jobs.map((job) => ({ job, target: jobTarget(job.name, job.data) }));
  const targets = await loadJobTargets(db, targetIds(rows.map((row) => row.target)));
  const error = typeof query.error === "string" ? ERRORS[query.error] : undefined;
  const retried = typeof query.listo === "string";

  const summary: { label: string; value: number; tab: JobViewTab }[] = [
    { label: "Esperando", value: counts.waiting, tab: "pending" },
    { label: "Programados", value: counts.scheduled, tab: "pending" },
    { label: "Corriendo", value: counts.active, tab: "active" },
    { label: "Fallidos (7 días)", value: counts.failed, tab: "failed" },
    { label: "Hechos (24 h)", value: counts.completed, tab: "done" },
  ];

  return (
    <section aria-labelledby="jobs-heading" className="flex flex-col gap-6">
      <Link href="/settings" className="plate-text w-fit text-ink-faint hover:text-ink">
        ← Ajustes
      </Link>
      <Plate as="h1" id="jobs-heading" aside="Worker">
        Cola de trabajos
      </Plate>
      <p className="max-w-[70ch] text-sm text-ink-dim">
        Lo que el worker tiene para hacer: generar, renderizar, publicar, avisar. Cada trabajo se
        reintenta solo unas veces; si igual falla, queda acá con el motivo. Los de un post se
        reintentan desde el post.
      </p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {summary.map((item) => (
          <Link
            key={item.label}
            href={`/settings/jobs?tab=${item.tab}`}
            className="flex flex-col gap-1 rounded-md border border-bezel px-4 py-3 hover:border-ink-faint"
          >
            <dt className="plate-text text-ink-faint">{item.label}</dt>
            <dd
              className={`timecode text-2xl ${item.tab === "failed" && item.value > 0 ? "text-tally-red" : "text-ink"}`}
            >
              {item.value}
            </dd>
          </Link>
        ))}
      </dl>

      {retried && (
        <p role="status" className="border-l border-tally-green pl-3 text-sm text-ink">
          Listo: el trabajo volvió a la cola y el worker lo toma en unos segundos.
        </p>
      )}
      {error && (
        <p role="alert" className="border-l border-tally-red pl-3 text-sm text-ink">
          {error}
        </p>
      )}

      <nav aria-label="Estado de los trabajos" className="border-b border-bezel">
        <ul className="flex flex-wrap gap-1">
          {(Object.keys(JOB_VIEW_TABS) as JobViewTab[]).map((key) => (
            <li key={key}>
              <Link
                href={`/settings/jobs?tab=${key}`}
                className="nav-key"
                aria-current={tab === key ? "page" : undefined}
              >
                {JOB_VIEW_TAB_LABELS[key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-bezel px-5 py-10">
          <p className="text-base text-ink">{EMPTY[tab]}</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-bezel rounded-md border border-bezel">
          {rows.map(({ job, target }) => {
            const state = STATE_DISPLAY[job.state];
            const about = describeTarget(target, targets);
            const message = job.state === "failed" ? jobError(job.output) : null;
            const retry =
              job.state === "failed"
                ? canRetryJob(job.name, job.state, retryContext(target, targets))
                : null;
            const post = targetPost(target, targets);
            return (
              <li key={job.id} className="flex flex-col gap-2 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-medium text-ink">
                      {isJobName(job.name) ? JOB_LABELS[job.name] : job.name}
                    </span>
                    {about.href ? (
                      <Link
                        href={about.href}
                        className="text-sm text-ink-dim underline underline-offset-2 hover:text-ink"
                      >
                        {about.text}
                      </Link>
                    ) : (
                      <span className="text-sm text-ink-dim">{about.text}</span>
                    )}
                  </span>
                  <Tally state={state.tally}>{state.label}</Tally>
                </div>
                <p className="timecode text-xs text-ink-faint">{timeline(job, now, zone)}</p>
                {message && (
                  <p className="border-l border-tally-red pl-3 text-sm break-words text-ink">
                    {message}
                  </p>
                )}
                {retry &&
                  (retry.ok ? (
                    <form action={retryJobAction}>
                      <input type="hidden" name="id" value={job.id} />
                      <button type="submit" className="console-button">
                        Reintentar
                      </button>
                    </form>
                  ) : (
                    <p className="flex flex-wrap items-center gap-3 text-sm text-ink-dim">
                      {retry.reason}
                      {retry.open === "post" && post && (
                        <Link href={`/posts/${post.publicCode}`} className="console-button">
                          Abrir {post.publicCode}
                        </Link>
                      )}
                      {retry.open === "ideas" && (
                        <Link href="/ideas" className="console-button">
                          Abrir Ideas
                        </Link>
                      )}
                    </p>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
      {rows.length === LIMIT && (
        <p className="text-xs text-ink-faint">Se muestran los {LIMIT} más recientes.</p>
      )}
    </section>
  );
}

const EMPTY: Record<JobViewTab, string> = {
  pending: "No hay nada esperando.",
  active: "El worker no está corriendo nada ahora.",
  failed: "No hay trabajos fallidos.",
  done: "No hay trabajos terminados guardados.",
};

/** When it was queued, runs or ran, and its attempts, in a line. */
function timeline(job: JobRow, now: Date, zone: string): string {
  const attempts =
    job.retryLimit > 0 ? `intento ${job.retryCount + 1} de ${job.retryLimit + 1}` : null;
  const parts: (string | null)[] = [];
  switch (job.state) {
    case "created":
    case "retry":
      parts.push(
        job.startAfter > now
          ? `arranca ${formatDateTime(job.startAfter, zone)}`
          : `en cola desde ${formatDateTime(job.createdOn, zone)}`,
        job.state === "retry" ? attempts : null,
      );
      break;
    case "active":
      parts.push(job.startedOn ? `empezó ${formatDateTime(job.startedOn, zone)}` : null, attempts);
      break;
    default:
      parts.push(
        `creado ${formatDateTime(job.createdOn, zone)}`,
        job.completedOn ? `terminó ${formatDateTime(job.completedOn, zone)}` : null,
        job.state === "failed" ? attempts : null,
      );
  }
  return parts.filter(Boolean).join(" · ");
}
