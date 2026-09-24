import { BRAND_DOCUMENT_KINDS, type BrandDocumentKind, isBrandDocumentKind } from "@radev/core";
import { getBrandBySlug, listBrandDocumentVersions } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandTabs } from "@/components/brands/brand-tabs";
import { DocumentEditor } from "@/components/brands/document-editor";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { DOCUMENT_INFO } from "@/lib/brand-documents";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { restoreDocumentAction } from "./actions";

export const metadata: Metadata = { title: "Documentos · RAdev Social" };

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// Voice, pricing, cases and rules of a brand: what the AI reads to write like it (phase 3).
// Every save is a new version; restoring an old one creates another.
export default async function BrandDocumentsPage({
  params,
  searchParams,
}: PageProps<"/brands/[slug]/documents">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const brand = await getBrandBySlug(db, slug);
  if (!brand) notFound();

  const requested = single(query.kind) ?? "voice";
  const kind: BrandDocumentKind = isBrandDocumentKind(requested) ? requested : "voice";
  const info = DOCUMENT_INFO[kind];
  const versions = await listBrandDocumentVersions(db, brand.id, kind);
  const current = versions[0];
  const viewing = Number(single(query.v));
  const old = versions.find((v) => v.version === viewing && v.id !== current?.id);
  const archived = brand.archivedAt !== null;
  const base = `/brands/${brand.slug}/documents?kind=${kind}`;

  return (
    <>
      <BrandTabs brand={brand} current="documents" />
      <section aria-labelledby="documents-heading" className="flex flex-col gap-6">
        <Plate as="h1" id="documents-heading" aside={brand.name}>
          Documentos
        </Plate>
        <nav aria-label="Documento" className="flex flex-wrap gap-2">
          {BRAND_DOCUMENT_KINDS.map((k) => (
            <Link
              key={k}
              href={`/brands/${brand.slug}/documents?kind=${k}`}
              className="console-button"
              aria-current={k === kind ? "page" : undefined}
            >
              {DOCUMENT_INFO[k].label}
            </Link>
          ))}
        </nav>
        <p className="max-w-[70ch] text-sm text-ink-dim">{info.hint}</p>

        {old ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Tally state="off">
                Versión {old.version} · {formatDateTime(old.createdAt, brand.timezone)}
              </Tally>
              <Link href={base} className="console-button">
                Volver a la actual
              </Link>
              {!archived && (
                <form action={restoreDocumentAction}>
                  <input type="hidden" name="slug" value={brand.slug} />
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="version" value={old.version} />
                  <button type="submit" className="console-button console-button-primary">
                    Restaurar esta versión
                  </button>
                </form>
              )}
            </div>
            <pre className="console-field max-h-[36rem] overflow-auto whitespace-pre-wrap font-mono text-sm leading-relaxed">
              {old.content}
            </pre>
          </div>
        ) : (
          <>
            {!current && (
              <p className="text-sm text-ink-faint">
                {brand.name} todavía no tiene {info.label.toLowerCase()}: escribilo abajo.
              </p>
            )}
            <DocumentEditor
              key={kind}
              slug={brand.slug}
              kind={kind}
              label={info.label}
              initial={current?.content ?? ""}
              readOnly={archived}
            />
          </>
        )}
      </section>

      {versions.length > 0 && (
        <section aria-labelledby="history-heading" className="flex flex-col gap-6">
          <Plate id="history-heading" aside={`${versions.length}`}>
            Historial
          </Plate>
          <ul className="flex flex-col divide-y divide-bezel rounded-md border border-bezel">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="flex items-center gap-3 text-sm text-ink">
                  <span className="timecode">v{v.version}</span>
                  <span className="text-ink-dim">
                    {formatDateTime(v.createdAt, brand.timezone)} ·{" "}
                    {[...v.content].length.toLocaleString("es-AR")} caracteres
                  </span>
                  {v.id === current?.id && <Tally state="ready">Actual</Tally>}
                </span>
                <span className="flex items-center gap-2">
                  {v.id !== current?.id && v.id !== old?.id && (
                    <Link href={`${base}&v=${v.version}`} className="console-button">
                      Ver
                    </Link>
                  )}
                  {v.id !== current?.id && !archived && (
                    <form action={restoreDocumentAction}>
                      <input type="hidden" name="slug" value={brand.slug} />
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="version" value={v.version} />
                      <button type="submit" className="console-button">
                        Restaurar
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-faint">
            Restaurar crea una versión nueva con ese contenido: no se pierde ninguna.
          </p>
        </section>
      )}
    </>
  );
}
