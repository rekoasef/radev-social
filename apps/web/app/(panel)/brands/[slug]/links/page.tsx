import { getBrandBySlug, getLinkTotals, listBrandLinks } from "@radev/db";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandTabs } from "@/components/brands/brand-tabs";
import { LinkForm } from "@/components/brands/link-form";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { CopyButton } from "@/components/posts/copy-button";
import { db } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import { deleteLinkAction, moveLinkAction } from "./actions";

export const metadata: Metadata = { title: "Links · RAdev Social" };

// The brand's public links page (phase 6 T5): its address for TikTok's profile, and its links.
export default async function BrandLinksPage({ params }: PageProps<"/brands/[slug]/links">) {
  const brand = await getBrandBySlug(db, (await params).slug);
  if (!brand) notFound();
  const [links, totals] = await Promise.all([
    listBrandLinks(db, brand.id),
    getLinkTotals(db, { brandId: brand.id, from: null }),
  ]);
  const publicUrl = new URL(`/l/${brand.slug}`, requireEnv("BETTER_AUTH_URL")).toString();
  const primary = links.find((link) => link.primary && link.active);
  const readOnly = brand.archivedAt !== null;

  return (
    <>
      <BrandTabs brand={brand} current="links" />
      <section aria-labelledby="links-heading" className="flex flex-col gap-6">
        <Plate as="h1" id="links-heading" aside={brand.name}>
          Página de links
        </Plate>
        <p className="max-w-3xl text-sm text-ink-dim">
          TikTok deja un solo link, en el perfil. Poné este: la página pregunta por qué post viene
          cada persona, y el mensaje de WhatsApp (o el link principal) lleva ese post. Así sabés qué
          contenido trae consultas.
        </p>

        <article className="flex max-w-3xl flex-col gap-4 rounded-md border border-bezel bg-panel p-5">
          <p className="timecode text-sm break-all text-ink">{publicUrl}</p>
          <div className="flex flex-wrap gap-3">
            <CopyButton label="Copiar link" text={publicUrl} />
            <a
              href={`/l/${brand.slug}`}
              target="_blank"
              rel="noreferrer"
              className="console-button inline-flex items-center gap-2"
            >
              Ver la página <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
          <p className="text-sm text-ink-faint">
            {totals.views} visitas · {totals.whatsapp} WhatsApp · {totals.links} clics a links,
            desde siempre (el detalle está en Métricas).
          </p>
        </article>

        <div className="flex max-w-3xl flex-col gap-2">
          {brand.whatsappNumber ? (
            <Tally state="ready">WhatsApp configurado</Tally>
          ) : primary ? (
            <Tally state="standby">Sin WhatsApp: los posts llevan a «{primary.title}»</Tally>
          ) : (
            <Tally state="live">Sin WhatsApp ni link principal</Tally>
          )}
          <p className="text-sm text-ink-dim">
            {brand.whatsappNumber ? (
              <>
                Elegir un post abre WhatsApp con el mensaje de{" "}
                <Link href={`/brands/${brand.slug}`} className="text-ink underline">
                  General → Contacto
                </Link>{" "}
                (con el código del post).
              </>
            ) : (
              <>
                Cargá el WhatsApp en{" "}
                <Link href={`/brands/${brand.slug}`} className="text-ink underline">
                  General → Contacto
                </Link>
                , o marcá un link como principal: sin ninguno de los dos, la página no ofrece elegir
                post.
              </>
            )}
          </p>
        </div>
      </section>

      <section aria-labelledby="list-heading" className="flex max-w-3xl flex-col gap-5">
        <Plate id="list-heading" aside={`${links.length}`}>
          Links
        </Plate>
        {links.length === 0 && (
          <p className="text-sm text-ink-faint">
            Todavía no hay links. Sumá la web, un portfolio o la app.
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {links.map((link, index) => (
            <li key={link.id} className="brand-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="flex flex-wrap items-center gap-2 text-ink">
                    {link.title}
                    {link.primary && <span className="callsign py-0.5 text-[11px]">Principal</span>}
                    {!link.active && <Tally state="off">Oculto</Tally>}
                  </p>
                  <p className="timecode truncate text-xs text-ink-faint">{link.url}</p>
                </div>
                {!readOnly && (
                  <div className="flex gap-1">
                    {(["up", "down"] as const).map((direction) => (
                      <form key={direction} action={moveLinkAction}>
                        <input type="hidden" name="slug" value={brand.slug} />
                        <input type="hidden" name="id" value={link.id} />
                        <input type="hidden" name="direction" value={direction} />
                        <button
                          type="submit"
                          className="console-button px-2.5 py-2"
                          disabled={direction === "up" ? index === 0 : index === links.length - 1}
                          aria-label={direction === "up" ? "Subir" : "Bajar"}
                        >
                          {direction === "up" ? (
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="size-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </form>
                    ))}
                    <form action={deleteLinkAction}>
                      <input type="hidden" name="slug" value={brand.slug} />
                      <input type="hidden" name="id" value={link.id} />
                      <button type="submit" className="console-button console-button-danger">
                        Borrar
                      </button>
                    </form>
                  </div>
                )}
              </div>
              {!readOnly && (
                <details>
                  <summary className="plate-text cursor-pointer text-ink-faint hover:text-ink">
                    Editar
                  </summary>
                  <div className="mt-4">
                    <LinkForm slug={brand.slug} link={link} />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
        {!readOnly && (
          <div className="flex flex-col gap-4 rounded-md border border-dashed border-bezel p-5">
            <h3 className="plate-text text-ink-dim">Nuevo link</h3>
            <LinkForm slug={brand.slug} />
          </div>
        )}
      </section>
    </>
  );
}
