import { IDEA_STATUSES, type IdeaStatus, isIdeaRequestOpen } from "@radev/core";
import {
  countIdeasByStatus,
  listActiveSeries,
  listIdeaRequests,
  listIdeas,
  listPillars,
} from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { AskAiForms } from "@/components/ideas/ask-ai-forms";
import { QuickIdeaForm } from "@/components/ideas/quick-idea-form";
import { RequestList } from "@/components/ideas/request-list";
import { getBrandContext } from "@/lib/active-brand";
import { db } from "@/lib/db";
import { IDEA_REQUEST_LABELS, IDEA_SOURCE_LABELS, IDEA_STATUS_LABELS } from "@/lib/ideas";
import { formatDateTime } from "@/lib/time";
import { ideaEventAction } from "./actions";

export const metadata: Metadata = { title: "Ideas · RAdev Social" };

function isIdeaStatus(value: unknown): value is IdeaStatus {
  return typeof value === "string" && (IDEA_STATUSES as readonly string[]).includes(value);
}

// The idea bank of the brand the panel is tuned to: quick load on top, the requests to the AI
// (propose, research), then the ideas by status. "Generar" opens "Generar con IA" with the idea;
// the idea turns used when the post is created.
export default async function IdeasPage({ searchParams }: PageProps<"/ideas">) {
  const { activeBrand: brand } = await getBrandContext();
  if (!brand) {
    return (
      <section>
        <Plate as="h1">Ideas</Plate>
        <p className="mt-6 text-sm text-ink-dim">No hay marcas activas.</p>
      </section>
    );
  }

  const { status } = await searchParams;
  const current: IdeaStatus = isIdeaStatus(status) ? status : "new";
  const [ideas, counts, pillars, series, requests] = await Promise.all([
    listIdeas(db, brand.id, current),
    countIdeasByStatus(db, brand.id),
    listPillars(db, brand.id),
    listActiveSeries(db, brand.id),
    listIdeaRequests(db, brand.id),
  ]);
  const options = (list: { key: string; name: string }[]) =>
    list.map(({ key, name }) => ({ key, name }));

  return (
    <section aria-labelledby="ideas-heading" className="flex flex-col gap-6">
      <Plate as="h1" id="ideas-heading">
        Ideas · {brand.name}
      </Plate>

      <QuickIdeaForm brand={{ id: brand.id, name: brand.name }} pillars={options(pillars)} />

      <section aria-labelledby="ask-ai-heading" className="flex flex-col gap-4">
        <Plate id="ask-ai-heading" aside="IA">
          Pedir a la IA
        </Plate>
        <AskAiForms
          brand={{ id: brand.id, name: brand.name }}
          pillars={options(pillars)}
          series={options(series)}
          open={requests.filter((r) => isIdeaRequestOpen(r.status)).map((r) => r.task)}
        />
        <RequestList
          requests={requests.map((r) => ({
            id: r.id,
            label: IDEA_REQUEST_LABELS[r.task],
            status: r.status,
            when: formatDateTime(r.createdAt, brand.timezone),
            ideaCount: r.ideaCount,
            error: r.error,
          }))}
        />
      </section>

      <nav aria-label="Filtrar por estado" className="border-b border-bezel">
        <ul className="flex flex-wrap gap-1">
          {IDEA_STATUSES.map((s) => (
            <li key={s}>
              <Link
                href={s === "new" ? "/ideas" : `/ideas?status=${s}`}
                className="nav-key"
                aria-current={current === s ? "page" : undefined}
              >
                {IDEA_STATUS_LABELS[s]}{" "}
                <span className="timecode text-ink-faint">{counts[s] ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {ideas.length === 0 ? (
        <div className="rounded-md border border-dashed border-bezel px-5 py-10">
          <p className="text-base text-ink">
            {current === "new"
              ? "No hay ideas nuevas."
              : current === "used"
                ? "Todavía no se generó ningún post desde una idea."
                : "No hay ideas descartadas."}
          </p>
          {current === "new" && (
            <p className="mt-1 text-sm text-ink-dim">Anotá la primera arriba: una línea alcanza.</p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-bezel rounded-md border border-bezel">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm text-ink">{idea.title}</p>
                {idea.angle && <p className="text-sm text-ink-dim">{idea.angle}</p>}
                <p className="timecode text-xs text-ink-faint">
                  {[
                    idea.pillarName ?? "Pilar a elección de la IA",
                    idea.seriesName && `Serie ${idea.seriesName}`,
                    idea.source !== "manual" &&
                      idea.source !== "series" &&
                      IDEA_SOURCE_LABELS[idea.source],
                    formatDateTime(idea.createdAt, brand.timezone),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {idea.sources.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                    {idea.sources.map((source) => (
                      <li key={source.url} className="truncate">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer nofollow"
                          className="text-ink-dim underline underline-offset-2 hover:text-ink"
                        >
                          {source.title}
                        </a>{" "}
                        <span className="text-ink-faint">{new URL(source.url).hostname}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {idea.status === "new" && (
                  <>
                    <Link
                      href={`/posts/new?idea=${idea.id}`}
                      className="console-button console-button-primary"
                    >
                      Generar
                    </Link>
                    <form action={ideaEventAction}>
                      <input type="hidden" name="brandId" value={brand.id} />
                      <input type="hidden" name="id" value={idea.id} />
                      <button type="submit" name="event" value="discard" className="console-button">
                        Descartar
                      </button>
                    </form>
                  </>
                )}
                {idea.status === "discarded" && (
                  <form action={ideaEventAction}>
                    <input type="hidden" name="brandId" value={brand.id} />
                    <input type="hidden" name="id" value={idea.id} />
                    <button type="submit" name="event" value="restore" className="console-button">
                      Recuperar
                    </button>
                  </form>
                )}
                {idea.status === "used" && idea.postCode && (
                  <Link href={`/posts/${idea.postCode}`} className="callsign">
                    {idea.postCode}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
