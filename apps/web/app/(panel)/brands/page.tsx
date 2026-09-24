import { parseTheme, presets } from "@radev/slides";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { getBrandContext } from "@/lib/active-brand";

export const metadata: Metadata = { title: "Marcas · RAdev Social" };

export default async function BrandsPage() {
  const { brands, activeBrand } = await getBrandContext();
  const active = brands.filter((brand) => brand.archivedAt === null);
  const archived = brands.filter((brand) => brand.archivedAt !== null);

  const list = (items: typeof brands) => (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((brand) => {
        const parsed = parseTheme(brand.stylePreset, brand.themeTokens);
        const swatches = parsed.ok
          ? [
              parsed.theme.tokens.colors.bg,
              parsed.theme.tokens.colors.accent,
              parsed.theme.tokens.colors.text,
            ]
          : [];
        const preset =
          brand.stylePreset in presets
            ? presets[brand.stylePreset as keyof typeof presets].name
            : brand.stylePreset;
        return (
          <li key={brand.id}>
            <Link href={`/brands/${brand.slug}`} className="brand-card">
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className="callsign">{brand.codePrefix}</span>
                  <span className="text-base font-semibold text-ink">{brand.name}</span>
                </span>
                {brand.id === activeBrand?.id && <Tally state="cued">Activa</Tally>}
                {brand.archivedAt && <Tally state="off">Archivada</Tally>}
              </span>
              <span className="flex items-center justify-between gap-3">
                <span className="timecode text-xs text-ink-faint">
                  {brand.slug} · {preset} · {brand.timezone.replaceAll("_", " ")}
                </span>
                <span className="flex" aria-hidden="true">
                  {swatches.map((color) => (
                    <span
                      key={color}
                      className="-ml-1 size-4 rounded-full border border-bezel-strong first:ml-0"
                      style={{ background: color }}
                    />
                  ))}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <section aria-labelledby="brands-heading" className="flex flex-col gap-6">
        <Plate
          as="h1"
          id="brands-heading"
          aside={
            <Link href="/brands/new" className="console-button">
              Nueva marca
            </Link>
          }
        >
          Marcas
        </Plate>
        {active.length > 0 ? (
          list(active)
        ) : (
          <div className="rounded-md border border-dashed border-bezel px-5 py-10">
            <p className="text-base text-ink">No hay marcas activas.</p>
            <p className="mt-1 text-sm text-ink-dim">Creá una con “Nueva marca”.</p>
          </div>
        )}
      </section>
      {archived.length > 0 && (
        <section aria-labelledby="archived-heading" className="flex flex-col gap-6">
          <Plate id="archived-heading" aside={`${archived.length}`}>
            Archivadas
          </Plate>
          {list(archived)}
        </section>
      )}
    </>
  );
}
