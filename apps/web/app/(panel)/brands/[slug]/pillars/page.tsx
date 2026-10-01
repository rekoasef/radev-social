import { shareToPercent } from "@radev/core";
import { getBrandBySlug, listBrandPillars } from "@radev/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandTabs } from "@/components/brands/brand-tabs";
import { NewPillarForm } from "@/components/brands/new-pillar-form";
import { PillarGuideForm } from "@/components/brands/pillar-guide-form";
import { PillarMixForm } from "@/components/brands/pillar-mix-form";
import { Plate } from "@/components/console/plate";
import { db } from "@/lib/db";
import { deletePillarAction, restorePillarAction } from "./actions";

export const metadata: Metadata = { title: "Pilares · RAdev Social" };

// Content pillars and their share of the brand's posts (docs/PRD.md RF-05). The AI picks among
// the active ones; the automatic slot filling (phase 4) follows the mix.
export default async function BrandPillarsPage({ params }: PageProps<"/brands/[slug]/pillars">) {
  const brand = await getBrandBySlug(db, (await params).slug);
  if (!brand) notFound();
  const pillars = await listBrandPillars(db, brand.id);
  const active = pillars.filter((p) => p.archivedAt === null);
  const archivedPillars = pillars.filter((p) => p.archivedAt !== null);
  const readOnly = brand.archivedAt !== null;
  const mix = active.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    percent: shareToPercent(p.targetShare),
    postCount: p.postCount,
  }));

  return (
    <>
      <BrandTabs brand={brand} current="pillars" />
      <section aria-labelledby="pillars-heading" className="flex flex-col gap-6">
        <Plate as="h1" id="pillars-heading" aside={brand.name}>
          Pilares
        </Plate>
        <p className="max-w-3xl text-sm text-ink-dim">
          De qué habla {brand.name} y en qué proporción. Los pilares activos suman 100 %.
        </p>
        {mix.length === 0 ? (
          <p className="text-sm text-ink">
            {brand.name} no tiene pilares activos: creá uno para poder generar posts.
          </p>
        ) : (
          <PillarMixForm
            // A new key after any change resets the typed percentages to the stored ones.
            key={mix.map((p) => `${p.id}:${p.percent}`).join()}
            brandSlug={brand.slug}
            pillars={mix}
            readOnly={readOnly}
          />
        )}
      </section>

      {active.length > 0 && (
        <section aria-labelledby="pillar-guides-heading" className="flex flex-col gap-6">
          <Plate id="pillar-guides-heading" aside="IA">
            Cómo se escribe cada pilar
          </Plate>
          <p className="max-w-3xl text-sm text-ink-dim">
            Lo que la IA sigue en los posts de cada pilar, además de la voz y las reglas de la
            marca. Todo es opcional.
          </p>
          <ul className="flex max-w-3xl flex-col divide-y divide-bezel rounded-md border border-bezel">
            {active.map((pillar) => (
              <li key={pillar.id}>
                <PillarGuideForm
                  brandSlug={brand.slug}
                  pillar={{
                    id: pillar.id,
                    name: pillar.name,
                    goal: pillar.goal,
                    hookTypes: pillar.hookTypes,
                    guide: pillar.guide,
                    closing: pillar.closing,
                    avoid: pillar.avoid,
                  }}
                  readOnly={readOnly}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!readOnly && (
        <section aria-labelledby="new-pillar-heading" className="flex flex-col gap-6">
          <Plate id="new-pillar-heading">Nuevo pilar</Plate>
          <NewPillarForm brandSlug={brand.slug} />
        </section>
      )}

      {archivedPillars.length > 0 && (
        <section aria-labelledby="archived-pillars-heading" className="flex flex-col gap-6">
          <Plate id="archived-pillars-heading">Archivados</Plate>
          <ul className="flex max-w-3xl flex-col divide-y divide-bezel rounded-md border border-bezel">
            {archivedPillars.map((pillar) => (
              <li
                key={pillar.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm text-ink">{pillar.name}</span>
                  <span className="timecode text-xs text-ink-faint">
                    {pillar.key} · {pillar.postCount} {pillar.postCount === 1 ? "post" : "posts"}
                  </span>
                </span>
                {!readOnly && (
                  <form className="flex gap-2">
                    <input type="hidden" name="slug" value={brand.slug} />
                    <input type="hidden" name="pillar" value={pillar.id} />
                    <button
                      type="submit"
                      formAction={restorePillarAction}
                      className="console-button"
                    >
                      Recuperar
                    </button>
                    {pillar.postCount === 0 && (
                      <button
                        type="submit"
                        formAction={deletePillarAction}
                        className="console-button"
                      >
                        Borrar
                      </button>
                    )}
                  </form>
                )}
              </li>
            ))}
          </ul>
          <p className="max-w-3xl text-sm text-ink-faint">Un pilar recuperado vuelve con 0 %.</p>
        </section>
      )}
    </>
  );
}
