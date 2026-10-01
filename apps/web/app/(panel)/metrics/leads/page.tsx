import {
  isLeadStatus,
  LEAD_CHANNEL_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  type LeadStatus,
} from "@radev/core";
import { getLeadTotals, listLeads, listLinksPagePosts } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { LeadForm } from "@/components/metrics/lead-form";
import { MetricsTabs } from "@/components/metrics/metrics-tabs";
import { getBrandContext } from "@/lib/active-brand";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { deleteLeadAction, setLeadStatusAction } from "./actions";

export const metadata: Metadata = { title: "Leads · Métricas · RAdev Social" };

const STATUS_TONE: Record<LeadStatus, string> = {
  new: "text-tally-blue",
  talking: "text-tally-amber",
  client: "text-tally-green",
  lost: "text-ink-faint",
};

// Leads of the active brand (phase 6 T5, RF-42): typed when someone writes, with the post their
// message named, so Métricas can say which content brings clients.
export default async function LeadsPage({ searchParams }: PageProps<"/metrics/leads">) {
  const { activeBrand: brand } = await getBrandContext();
  const query = await searchParams;
  const status = isLeadStatus(query.status) ? query.status : undefined;
  const search = typeof query.q === "string" ? query.q : "";

  if (!brand) {
    return (
      <section>
        <Plate as="h1">Leads</Plate>
        <p className="mt-6 text-sm text-ink-dim">No hay marcas activas.</p>
      </section>
    );
  }

  const [leads, totals, posts] = await Promise.all([
    listLeads(db, { brandId: brand.id, status, search }),
    getLeadTotals(db, { brandId: brand.id, from: null }),
    listLinksPagePosts(db, { brandId: brand.id, network: "tiktok", limit: 30 }),
  ]);
  const suggestions = posts.map((post) => ({ ref: post.ref, caption: post.caption }));
  const filterHref = (next: LeadStatus | undefined) => {
    const params = new URLSearchParams();
    if (next) params.set("status", next);
    if (search) params.set("q", search);
    const text = params.toString();
    return text ? `/metrics/leads?${text}` : "/metrics/leads";
  };

  return (
    <>
      <MetricsTabs current="leads" />
      <section aria-labelledby="new-lead-heading" className="flex flex-col gap-5">
        <Plate
          as="h1"
          id="new-lead-heading"
          aside={`${totals.leads} leads · ${totals.clients} clientes`}
        >
          Leads de {brand.name}
        </Plate>
        <p className="max-w-3xl text-sm text-ink-dim">
          Cuando alguien te escribe, anotalo acá con el código que trae el mensaje (RA-0142, o TK-…
          para los posts de antes del sistema). Con eso Métricas te dice qué contenido trae
          consultas y clientes.
        </p>
        <div className="rounded-md border border-bezel bg-panel p-5">
          <LeadForm slug={brand.slug} posts={suggestions} />
        </div>
      </section>

      <section aria-labelledby="leads-heading" className="flex flex-col gap-5">
        <Plate id="leads-heading" aside={`${leads.length}`}>
          Anotados
        </Plate>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Estado" className="flex flex-wrap gap-1">
            <Link
              href={filterHref(undefined)}
              className="nav-key"
              aria-current={status ? undefined : "page"}
            >
              Todos
            </Link>
            {LEAD_STATUSES.map((s) => (
              <Link
                key={s}
                href={filterHref(s)}
                className="nav-key"
                aria-current={status === s ? "page" : undefined}
              >
                {LEAD_STATUS_LABELS[s]}
              </Link>
            ))}
          </nav>
          <form action="/metrics/leads" className="flex gap-2">
            {status && <input type="hidden" name="status" value={status} />}
            <input
              name="q"
              defaultValue={search}
              placeholder="Buscar nombre, contacto o código"
              aria-label="Buscar"
              className="console-field w-64 max-w-full"
            />
            <button type="submit" className="console-button">
              Buscar
            </button>
          </form>
        </div>

        {leads.length === 0 ? (
          <p className="text-sm text-ink-faint">
            {search || status ? "Nada con ese filtro." : "Todavía no hay leads anotados."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {leads.map((lead) => (
              <li key={lead.id} className="brand-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="text-ink">
                      {lead.name || lead.contact}
                      <span className={cn("plate-text ml-3", STATUS_TONE[lead.status])}>
                        {LEAD_STATUS_LABELS[lead.status]}
                      </span>
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                      {lead.name && lead.contact && (
                        <span className="timecode">{lead.contact}</span>
                      )}
                      <span>{LEAD_CHANNEL_LABELS[lead.channel]}</span>
                      {lead.postRef && (
                        <span
                          className={cn(
                            "callsign py-0.5 text-[11px]",
                            !lead.networkPostId && "opacity-60",
                          )}
                        >
                          {lead.postRef}
                        </span>
                      )}
                      <span className="timecode">
                        {formatDateTime(lead.createdAt, brand.timezone)}
                      </span>
                    </p>
                    {lead.postCaption && (
                      <p className="line-clamp-1 max-w-[60ch] text-xs text-ink-faint">
                        {lead.postCaption}
                      </p>
                    )}
                    {lead.notes && (
                      <p className="max-w-[70ch] text-sm text-ink-dim">{lead.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {LEAD_STATUSES.filter((s) => s !== lead.status).map((s) => (
                      <form key={s} action={setLeadStatusAction}>
                        <input type="hidden" name="slug" value={brand.slug} />
                        <input type="hidden" name="id" value={lead.id} />
                        <input type="hidden" name="status" value={s} />
                        <button type="submit" className="console-button px-2.5 py-2">
                          {LEAD_STATUS_LABELS[s]}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
                <details>
                  <summary className="plate-text cursor-pointer text-ink-faint hover:text-ink">
                    Editar
                  </summary>
                  <div className="mt-4 flex flex-col gap-4">
                    <LeadForm slug={brand.slug} posts={suggestions} lead={lead} />
                    <form action={deleteLeadAction}>
                      <input type="hidden" name="slug" value={brand.slug} />
                      <input type="hidden" name="id" value={lead.id} />
                      <button type="submit" className="console-button console-button-danger">
                        Borrar lead
                      </button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
