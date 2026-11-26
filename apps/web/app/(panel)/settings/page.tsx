import {
  AI_TASK_LABELS,
  AI_TASKS,
  type AiTask,
  DATA_REFRESH_TZ,
  DATA_SOURCE_LABELS,
  DATA_SOURCES,
  FILL_DAYS,
  FILL_REPORT_KEY,
  type FillReport,
  formatDataDate,
  GENERATION_WINDOW_KEY,
  parseGenerationWindow,
  TOOL_TASKS,
} from "@radev/core";
import {
  countJobs,
  getLatestSnapshot,
  getSetting,
  listAiRoutes,
  listBrands,
  listRecentNotifications,
  snapshotData,
} from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { AiRouteForm } from "@/components/settings/ai-route-form";
import { GenerationWindowForm } from "@/components/settings/generation-window-form";
import { timezoneOptions } from "@/lib/brand-form";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { refreshDataAction, sendTestNotificationAction } from "./actions";

export const metadata: Metadata = { title: "Ajustes · RAdev Social" };

const TASK_HINTS: Record<AiTask, string> = {
  "carousel.generate": "Escribe el carrusel a partir de una idea. Conviene la mejor calidad.",
  "slide.rewrite":
    "Rehace una slide desde el editor con una instrucción. Conviene la misma calidad que el carrusel.",
  "ideas.generate": "Propone ideas según los pilares. Es volumen: sirve un modelo gratuito.",
  "ideas.research": "Busca temas del nicho en la web.",
  "caption.variants": "Variantes de la descripción del post.",
  "metrics.extract": "Lee capturas de las analíticas de TikTok.",
  "video.research": "Video: investiga el tema en la web y arma el dossier con fuentes.",
  "video.sources":
    "Video: lee la página real de cada fuente y copia la frase que respalda cada hecho. Lo comprueba el código.",
  "video.images": "Video: elige entre las imágenes de archivo encontradas en Commons.",
  "video.script": "Video: escribe el guion mirando las imágenes. Conviene la mejor calidad.",
  "video.review": "Video: verifica los hechos del guion contra el dossier.",
  "video.package": "Video: título, capítulos y miniatura para subir a YouTube.",
  "video.ideas": "Video: propone temas sin buscar en la web.",
  "video.ideas.research": "Video: busca en la web temas actuales y trae sus fuentes.",
};

// Which provider and model each AI task uses, and its fallback (docs/ARCHITECTURE.md §7).
// Global routes: a brand's own route (the database allows it) is for later.
export default async function SettingsPage() {
  const [allRoutes, brands, snapshots, storedWindow, lastFill, notices, jobs] = await Promise.all([
    listAiRoutes(db),
    listBrands(db),
    Promise.all(
      DATA_SOURCES.map(async (source) => [source, await getLatestSnapshot(db, source)] as const),
    ),
    getSetting(db, GENERATION_WINDOW_KEY),
    getSetting(db, FILL_REPORT_KEY) as Promise<FillReport | undefined>,
    listRecentNotifications(db, 6),
    countJobs(db, new Date()),
  ]);
  // Only whether they are there: the values never reach the page.
  const telegramReady = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  const window = parseGenerationWindow(storedWindow);
  const routes = allRoutes.filter((route) => route.brandId === null);

  return (
    <>
      <section aria-labelledby="routing-heading" className="flex flex-col gap-6">
        <Plate as="h1" id="routing-heading" aside="IA">
          Ruteo de IA
        </Plate>
        <div className="flex max-w-[70ch] flex-col gap-2 text-sm text-ink-dim">
          <p>
            Cada tarea usa el proveedor principal. Si llega a su límite o falla, pasa al respaldo;
            si la respuesta vino mal armada, no (se regenera con el mismo).
          </p>
          <p>
            Claude Code usa tu suscripción: modelos como <span className="timecode">sonnet</span> u{" "}
            <span className="timecode">opus</span>. OpenRouter solo acepta modelos gratuitos
            (terminan en <span className="timecode">:free</span>); la cuenta gratuita permite 50
            pedidos por día y los modelos cambian seguido: buscalos en{" "}
            <a
              href="https://openrouter.ai/models?order=newest&supported_parameters=structured_outputs"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              openrouter.ai/models
            </a>
            .
          </p>
          <p>
            Los topes de generaciones por marca se editan en{" "}
            <Link href="/brands" className="underline underline-offset-4">
              Marcas
            </Link>
            .
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-bezel rounded-md border border-bezel">
          {AI_TASKS.map((task) => (
            <li key={task} className="flex flex-col gap-4 px-4 py-5 sm:px-6">
              <div className="flex flex-col gap-1">
                <h2 className="flex flex-wrap items-baseline gap-3 text-base font-semibold text-ink">
                  {AI_TASK_LABELS[task]}
                  <span className="timecode text-xs font-normal text-ink-faint">{task}</span>
                </h2>
                <p className="text-sm text-ink-dim">
                  {TASK_HINTS[task]}
                  {TOOL_TASKS.includes(task) && " Necesita herramientas: solo Claude Code."}
                </p>
              </div>
              <AiRouteForm
                task={task}
                route={routes.find((route) => route.task === task) ?? null}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Automatic filling (phase 4, T4): the window and what its last run did. */}
      <section aria-labelledby="fill-heading" className="flex flex-col gap-6">
        <Plate id="fill-heading" aside="Piloto automático">
          Generación automática
        </Plate>
        <div className="flex max-w-[70ch] flex-col gap-2 text-sm text-ink-dim">
          <p>
            Dentro de la ventana, cada 15 minutos, los horarios libres de los próximos {FILL_DAYS}{" "}
            días de cada marca reciben un post para que escriba la IA: el pilar que más falta según
            la mezcla y la idea más vieja del banco. Si no hay ideas, se las pide a la IA. Respeta
            los topes de cada marca. Al aprobar esos posts se programan solos.
          </p>
          <p>
            Además, una vez por semana cada marca recibe su investigación de temas en la web (como
            "Investigar temas" en Ideas): las ideas nuevas quedan en el banco.
          </p>
          <p>Conviene de madrugada, para no competir con tu uso de Claude.</p>
        </div>
        <GenerationWindowForm
          key={JSON.stringify(window)}
          window={window}
          timeZones={timezoneOptions(window.timeZone)}
        />
        <div className="flex max-w-3xl flex-col gap-2">
          <h2 className="text-sm text-ink">Última pasada</h2>
          {lastFill ? (
            <>
              <p className="timecode text-xs text-ink-faint">
                {formatDateTime(new Date(lastFill.at), window.timeZone)}
              </p>
              <ul className="flex flex-col divide-y divide-bezel rounded-md border border-bezel">
                {lastFill.brands.map((entry) => (
                  <li key={entry.slug} className="flex flex-col gap-1 px-4 py-3 text-sm">
                    <span className="text-ink">
                      {brands.find((b) => b.slug === entry.slug)?.name ?? entry.slug}
                      {": "}
                      {entry.created.length > 0
                        ? `${entry.created.length} ${entry.created.length === 1 ? "post nuevo" : "posts nuevos"} (${entry.created.join(", ")})`
                        : "nada nuevo"}
                    </span>
                    {(entry.unfilled > 0 ||
                      entry.note ||
                      entry.requestedIdeasFor ||
                      entry.researched) && (
                      <span className="text-ink-dim">
                        {entry.unfilled > 0 &&
                          `${entry.unfilled} ${entry.unfilled === 1 ? "horario quedó libre" : "horarios quedaron libres"}. `}
                        {entry.note}
                        {entry.requestedIdeasFor &&
                          ` Se pidieron ideas para el pilar ${entry.requestedIdeasFor}.`}
                        {entry.researched && " Se pidió la investigación semanal de temas."}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-faint">Todavía no corrió dentro de la ventana.</p>
          )}
        </div>
      </section>

      {/* Notices to the operator (phase 4, T6). */}
      <section aria-labelledby="telegram-heading" className="flex flex-col gap-6">
        <Plate id="telegram-heading" aside="Avisos">
          Telegram
        </Plate>
        <div className="flex max-w-[70ch] flex-col gap-2 text-sm text-ink-dim">
          <p>
            El bot te avisa de los posts para revisar (juntos; los de la madrugada, al terminar la
            ventana), la hora de publicar cada post, lo que falla y los límites de la IA. Dentro de
            la ventana de generación llegan sin sonido, salvo la hora de publicar.
          </p>
          <p>
            {telegramReady ? (
              <span className="text-ink">Configurado.</span>
            ) : (
              <span className="text-tally-amber">
                Sin configurar: falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en el .env. Los avisos
                se guardan igual.
              </span>
            )}
          </p>
        </div>
        <form action={sendTestNotificationAction}>
          <button type="submit" className="console-button">
            Enviar prueba
          </button>
        </form>
        <div className="flex max-w-3xl flex-col gap-2">
          <h2 className="text-sm text-ink">Últimos avisos</h2>
          {notices.length === 0 ? (
            <p className="text-sm text-ink-faint">Todavía no hubo avisos.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-bezel rounded-md border border-bezel">
              {notices.map((notice) => (
                <li key={notice.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="line-clamp-1 min-w-0 text-ink">
                      {notice.text.split("\n")[0]}
                    </span>
                    <span className="timecode shrink-0 text-xs text-ink-faint">
                      {formatDateTime(notice.createdAt, window.timeZone)} ·{" "}
                      {notice.sentAt ? "enviado" : notice.error ? "sin enviar" : "en cola"}
                    </span>
                  </span>
                  {!notice.sentAt && notice.error && (
                    <span className="text-xs text-tally-red">{notice.error}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* The worker's queue (phase 4, T8): a summary here, the detail in /settings/jobs. */}
      <section aria-labelledby="jobs-heading" className="flex flex-col gap-6">
        <Plate id="jobs-heading" aside="Worker">
          Cola de trabajos
        </Plate>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-dim">
          <span>
            <span className="timecode text-ink">{jobs.waiting + jobs.scheduled}</span> pendientes
          </span>
          <span>
            <span className="timecode text-ink">{jobs.active}</span> corriendo
          </span>
          <span>
            <span className={`timecode ${jobs.failed > 0 ? "text-tally-red" : "text-ink"}`}>
              {jobs.failed}
            </span>{" "}
            fallidos en 7 días
          </span>
          <Link
            href={jobs.failed > 0 ? "/settings/jobs?tab=failed" : "/settings/jobs"}
            className="console-button"
          >
            Ver trabajos
          </Link>
        </div>
      </section>

      {/* Real data for the content (phase 3, T11): what data.refresh fetched last. */}
      <section aria-labelledby="data-heading" className="flex flex-col gap-6">
        <Plate id="data-heading" aside="Datos">
          Datos reales
        </Plate>
        <p className="max-w-[70ch] text-sm text-ink-dim">
          Se actualizan solos una vez por día (19:00, hora de Buenos Aires). Cada marca elige qué
          fuentes usa en Marcas → General. Los posts guardan los datos con los que se escribieron:
          actualizar no cambia los gráficos de un post ya hecho.
        </p>
        <ul className="flex flex-col divide-y divide-bezel rounded-md border border-bezel">
          {snapshots.map(([source, snapshot]) => {
            const users = brands.filter(
              (b) => b.archivedAt === null && b.dataSources.includes(source),
            );
            const figures = snapshot ? snapshotData(snapshot).figures : [];
            return (
              <li key={source} className="flex flex-col gap-4 px-4 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold text-ink">
                      {DATA_SOURCE_LABELS[source]}
                    </h2>
                    <p className="text-sm text-ink-dim">
                      {snapshot
                        ? `Datos del ${formatDataDate(snapshot.asOf)} · bajados el ${formatDateTime(snapshot.fetchedAt, DATA_REFRESH_TZ)}`
                        : "Todavía no se bajó nada."}
                      {" · "}
                      {users.length > 0
                        ? `La usa ${users.map((b) => b.name).join(", ")}`
                        : "Ninguna marca la usa"}
                    </p>
                  </div>
                  <form action={refreshDataAction}>
                    <input type="hidden" name="source" value={source} />
                    <button type="submit" className="console-button">
                      Actualizar ahora
                    </button>
                  </form>
                </div>
                {figures.length > 0 && (
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {figures.map((figure) => (
                      <div key={figure.key} className="flex justify-between gap-3">
                        <dt className="text-ink-dim">{figure.label}</dt>
                        <dd className="timecode text-ink">{figure.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
