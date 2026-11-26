import { Plate } from "@/components/console/plate";
import { CopyButton } from "@/components/posts/copy-button";
import type { Delivery } from "@/lib/video-delivery";
import { elapsed } from "@/lib/video-display";
import { Players } from "./players";
import { ReopenVideo, VideoDecision } from "./video-decision";

const number = new Intl.NumberFormat("es-AR");
const size = (bytes: number) =>
  bytes < 100_000
    ? `${Math.max(1, Math.round(bytes / 1e3))} KB`
    : `${(bytes / 1e6).toFixed(1).replace(".", ",")} MB`;

/** The second desk, and what an approved video keeps showing: watch, copy and download. */
export function VideoDesk({
  videoId,
  delivery,
  approved,
  paused,
}: {
  videoId: string;
  delivery: Delivery;
  approved: boolean;
  paused: boolean;
}) {
  const { report } = delivery;
  const total = delivery.files.reduce((sum, f) => sum + (f.bytes ?? 0), 0);

  return (
    <>
      <p className="timecode flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-dim">
        <span>{delivery.seconds.toFixed(1).replace(".", ",")} s</span>
        <span>Short 9:16 y normal 16:9</span>
        <span>{delivery.scenes} escenas</span>
        <span>{number.format(delivery.characters)} caracteres de voz</span>
      </p>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-11">
          <Players formats={delivery.formats} chapters={delivery.chapters} />

          <section aria-labelledby="thumbs-heading" className="flex flex-col gap-4">
            <Plate id="thumbs-heading">Miniaturas</Plate>
            <div className="flex flex-wrap items-end gap-5">
              {[...delivery.formats].reverse().map((f) => (
                // biome-ignore lint/performance/noImgElement: a file of the video, shown as it is
                <img
                  key={f.format}
                  src={f.poster}
                  alt={`Miniatura ${f.format === "9x16" ? "del Short" : "del video normal"}`}
                  loading="lazy"
                  className={`rounded-md border border-bezel-strong bg-black ${
                    f.format === "9x16" ? "w-36" : "w-full max-w-md"
                  }`}
                />
              ))}
            </div>
          </section>

          <section aria-labelledby="desc-heading" className="flex flex-col gap-4">
            <Plate id="desc-heading" aside="para pegar en YouTube">
              Descripciones
            </Plate>
            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  ["Normal · con capítulos", delivery.descriptions.normal],
                  ["Short · #Shorts", delivery.descriptions.short],
                ] as const
              ).map(([label, text]) => (
                <article key={label} className="rounded-md border border-bezel bg-panel">
                  <header className="flex items-center justify-between gap-2 border-b border-bezel px-3 py-2">
                    <h3 className="plate-text text-ink">{label}</h3>
                    <CopyButton label="Copiar" text={text} />
                  </header>
                  <pre className="max-h-80 overflow-y-auto p-3.5 font-sans text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-dim">
                    {text}
                  </pre>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="report-heading" className="flex flex-col gap-4">
            <Plate id="report-heading">Informe del video</Plate>
            <div className="overflow-x-auto rounded-md border border-bezel bg-panel">
              <table className="w-full text-sm">
                <thead>
                  <tr className="plate-text border-b border-bezel text-left text-ink-faint">
                    <th className="px-3 py-2.5">Oficina</th>
                    <th className="px-3 py-2.5 max-md:hidden">Quién</th>
                    <th className="px-3 py-2.5 text-right">Gasto</th>
                    <th className="px-3 py-2.5 text-right">Tiempo</th>
                    <th className="px-3 py-2.5 max-md:hidden">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bezel">
                  {[...report.rows, report.total].map((row) => (
                    <tr key={row.office} className={row === report.total ? "font-semibold" : ""}>
                      <th scope="row" className="px-3 py-2.5 text-left font-[inherit]">
                        {row.office}
                      </th>
                      <td className="px-3 py-2.5 text-ink-dim max-md:hidden">{row.who}</td>
                      <td className="timecode px-3 py-2.5 text-right whitespace-nowrap">
                        {row.spent}
                      </td>
                      <td className="timecode px-3 py-2.5 text-right">
                        {row.ms === null ? "—" : elapsed(row.ms)}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-ink-dim max-md:hidden">
                        {row.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-32">
          {approved ? (
            <ReopenVideo videoId={videoId} />
          ) : (
            <VideoDecision
              videoId={videoId}
              version={delivery.version}
              characters={delivery.characters}
              paused={paused}
            />
          )}
          <section aria-labelledby="package-heading" className="desk-panel flex flex-col gap-3">
            <h2 id="package-heading" className="plate-text flex justify-between text-ink">
              Paquete <span className="timecode text-ink-faint">ZIP · {size(total)}</span>
            </h2>
            <ul className="timecode text-xs leading-6 text-ink-dim">
              <li className="font-semibold break-all text-ink">{delivery.slug}/</li>
              {delivery.files.map((f) => (
                <li key={f.name} className="flex justify-between gap-3 pl-3">
                  <span>{f.name}</span>
                  <span className={f.bytes === null ? "text-tally-red" : "text-ink-faint"}>
                    {f.bytes === null ? "falta" : size(f.bytes)}
                  </span>
                </li>
              ))}
            </ul>
            {approved ? (
              <a
                href={`/videos/${videoId}/download`}
                download
                className="console-button console-button-primary text-center"
              >
                Descargar paquete
              </a>
            ) : (
              <p className="text-sm text-ink-faint">La descarga se habilita al aprobar el video.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
