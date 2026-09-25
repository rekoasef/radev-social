import {
  AI_TASK_LABELS,
  AI_TASKS,
  type AiTask,
  DATA_REFRESH_TZ,
  DATA_SOURCE_LABELS,
  DATA_SOURCES,
  formatDataDate,
  TOOL_TASKS,
} from "@radev/core";
import { getLatestSnapshot, listAiRoutes, listBrands, snapshotData } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { AiRouteForm } from "@/components/settings/ai-route-form";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { refreshDataAction } from "./actions";

export const metadata: Metadata = { title: "Ajustes · RAdev Social" };

const TASK_HINTS: Record<AiTask, string> = {
  "carousel.generate": "Escribe el carrusel a partir de una idea. Conviene la mejor calidad.",
  "ideas.generate": "Propone ideas según los pilares. Es volumen: sirve un modelo gratuito.",
  "ideas.research": "Busca temas del nicho en la web.",
  "caption.variants": "Variantes de la descripción del post.",
  "metrics.extract": "Lee capturas de las analíticas de TikTok.",
};

// Which provider and model each AI task uses, and its fallback (docs/ARCHITECTURE.md §7).
// Global routes: a brand's own route (the database allows it) is for later.
export default async function SettingsPage() {
  const [allRoutes, brands, snapshots] = await Promise.all([
    listAiRoutes(db),
    listBrands(db),
    Promise.all(
      DATA_SOURCES.map(async (source) => [source, await getLatestSnapshot(db, source)] as const),
    ),
  ]);
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
