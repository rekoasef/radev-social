import { getBrandBySlug, listBrandSeries, listPillars } from "@radev/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandTabs } from "@/components/brands/brand-tabs";
import { SeriesForm } from "@/components/brands/series-form";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { db } from "@/lib/db";
import { SERIES_SLIDE_CHOICES } from "@/lib/series";
import { archiveSeriesAction, deleteSeriesAction, restoreSeriesAction } from "./actions";

export const metadata: Metadata = { title: "Series · RAdev Social" };

// Recurring series of a brand (docs/PRD.md RF-12): a fixed structure the AI follows for every
// post of the series. Ideas and posts can belong to one.
export default async function BrandSeriesPage({ params }: PageProps<"/brands/[slug]/series">) {
  const brand = await getBrandBySlug(db, (await params).slug);
  if (!brand) notFound();
  const [series, pillars] = await Promise.all([
    listBrandSeries(db, brand.id),
    listPillars(db, brand.id),
  ]);
  const readOnly = brand.archivedAt !== null;
  const pillarOptions = pillars.map((p) => ({ key: p.key, name: p.name }));

  return (
    <>
      <BrandTabs brand={brand} current="series" />
      <section aria-labelledby="series-heading" className="flex flex-col gap-6">
        <Plate as="h1" id="series-heading" aside={brand.name}>
          Series
        </Plate>
        <p className="max-w-3xl text-sm text-ink-dim">
          Formatos que se repiten con la misma estructura. La IA los usa al proponer ideas y al
          escribir los posts de cada serie.
        </p>
        {series.length === 0 && (
          <p className="text-sm text-ink">{brand.name} no tiene series todavía.</p>
        )}
        {series.map((s) => (
          <details
            key={s.id}
            className="max-w-3xl rounded-md border border-bezel px-4 py-3 open:pb-5"
          >
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm text-ink">{s.name}</span>
                <span className="timecode text-xs text-ink-faint">
                  {[s.key, s.pillarName, `${s.ideaCount} ${s.ideaCount === 1 ? "idea" : "ideas"}`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {s.archivedAt && <Tally state="off">Archivada</Tally>}
            </summary>
            <div className="mt-4 flex flex-col gap-5">
              <SeriesForm
                key={s.updatedAt.toISOString()}
                brandSlug={brand.slug}
                values={{
                  id: s.id,
                  key: s.key,
                  name: s.name,
                  pillarKey: s.pillarKey,
                  hookType: s.hookType,
                  brief: s.brief,
                  requiredSlides: s.requiredSlides,
                }}
                pillars={pillarOptions}
                slideChoices={SERIES_SLIDE_CHOICES}
                readOnly={readOnly || s.archivedAt !== null}
              />
              {!readOnly && (
                <form className="flex flex-wrap gap-2 border-t border-bezel pt-4">
                  <input type="hidden" name="slug" value={brand.slug} />
                  <input type="hidden" name="id" value={s.id} />
                  {s.archivedAt ? (
                    <button
                      type="submit"
                      formAction={restoreSeriesAction}
                      className="console-button"
                    >
                      Recuperar
                    </button>
                  ) : (
                    <button
                      type="submit"
                      formAction={archiveSeriesAction}
                      className="console-button"
                    >
                      Archivar
                    </button>
                  )}
                  {s.ideaCount === 0 && (
                    <button
                      type="submit"
                      formAction={deleteSeriesAction}
                      className="console-button"
                    >
                      Borrar
                    </button>
                  )}
                </form>
              )}
            </div>
          </details>
        ))}
      </section>

      {!readOnly && (
        <section aria-labelledby="new-series-heading" className="flex flex-col gap-6">
          <Plate id="new-series-heading">Nueva serie</Plate>
          <SeriesForm
            brandSlug={brand.slug}
            pillars={pillarOptions}
            slideChoices={SERIES_SLIDE_CHOICES}
          />
        </section>
      )}
    </>
  );
}
