import { getBrandBySlug, listBrandAssets } from "@radev/db";
import {
  defaultTokens,
  isStylePreset,
  parseTheme,
  presets,
  STYLE_PRESETS,
  type StylePreset,
  tokenFormSpec,
} from "@radev/slides";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandTabs } from "@/components/brands/brand-tabs";
import { IdentityEditor } from "@/components/brands/identity-editor";
import { Plate } from "@/components/console/plate";
import { mediaUrl, ROLE_LABELS } from "@/lib/brand-assets";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Identidad visual · RAdev Social" };

export default async function IdentityPage({ params }: PageProps<"/brands/[slug]/identity">) {
  const brand = await getBrandBySlug(db, (await params).slug);
  if (!brand) notFound();

  const preset: StylePreset = isStylePreset(brand.stylePreset) ? brand.stylePreset : "bold";
  const parsed = parseTheme(preset, brand.themeTokens);
  // Stored tokens that no longer validate open with the preset's defaults; nothing is lost
  // until the operator saves.
  const tokens = parsed.ok ? parsed.theme.tokens : defaultTokens(preset);
  const assets = await listBrandAssets(db, brand.id);

  return (
    <>
      <BrandTabs brand={brand} current="identity" />
      <section aria-labelledby="identity-heading" className="flex flex-col gap-6">
        <Plate as="h1" id="identity-heading" aside={brand.name}>
          Identidad visual
        </Plate>
        {!parsed.ok && (
          <p role="alert" className="border-l border-tally-red pl-3 text-sm text-ink">
            La identidad guardada tenía errores ({parsed.issues.join("; ")}). Se abrió con los
            valores por defecto: revisala y guardá.
          </p>
        )}
        <IdentityEditor
          brand={{ id: brand.id, name: brand.name, slug: brand.slug }}
          initial={{ preset, tokens }}
          presets={STYLE_PRESETS.map((id) => ({
            id,
            name: presets[id].name,
            description: presets[id].description,
          }))}
          specs={
            Object.fromEntries(STYLE_PRESETS.map((id) => [id, tokenFormSpec(id)])) as Record<
              StylePreset,
              ReturnType<typeof tokenFormSpec>
            >
          }
          assets={assets.map((a) => ({
            id: a.id,
            role: a.role,
            url: mediaUrl(a.path),
            label: `${ROLE_LABELS[a.role]} · ${a.mime.replace("image/", "").replace("+xml", "").toUpperCase()}${a.width && a.height ? ` ${a.width}×${a.height}` : ""}`,
          }))}
        />
      </section>
    </>
  );
}
