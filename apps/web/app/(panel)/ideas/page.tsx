import { IDEA_STATUSES, type IdeaStatus } from "@radev/core";
import { countIdeasByStatus, listIdeas, listPillars } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { QuickIdeaForm } from "@/components/ideas/quick-idea-form";
import { getBrandContext } from "@/lib/active-brand";
import { db } from "@/lib/db";
import { IDEA_SOURCE_LABELS, IDEA_STATUS_LABELS } from "@/lib/ideas";
import { formatDateTime } from "@/lib/time";
import { ideaEventAction } from "./actions";

export const metadata: Metadata = { title: "Ideas · RAdev Social" };

function isIdeaStatus(value: unknown): value is IdeaStatus {
  return typeof value === "string" && (IDEA_STATUSES as readonly string[]).includes(value);
}

// The idea bank of the brand the panel is tuned to: quick load on top, then the ideas by status.
// "Generar" opens "Generar con IA" with the idea; the idea turns used when the post is created.
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
  const [ideas, counts, pillars] = await Promise.all([
    listIdeas(db, brand.id, current),
    countIdeasByStatus(db, brand.id),
    listPillars(db, brand.id),
  ]);

  return (
    <section aria-labelledby="ideas-heading" className="flex flex-col gap-6">
      <Plate as="h1" id="ideas-heading">
        Ideas · {brand.name}
      </Plate>

      <QuickIdeaForm
        brand={{ id: brand.id, name: brand.name }}
        pillars={pillars.map((p) => ({ key: p.key, name: p.name }))}
      />

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
                    idea.source !== "manual" && IDEA_SOURCE_LABELS[idea.source],
                    formatDateTime(idea.createdAt, brand.timezone),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
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
