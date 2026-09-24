import { getBrandBySlug, listBrandAssets } from "@radev/db";
import { parseTheme, type SlideAssets } from "@radev/slides";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandTabs } from "@/components/brands/brand-tabs";
import { SlideGallery } from "@/components/brands/slide-gallery";
import { Plate } from "@/components/console/plate";
import { mediaUrl } from "@/lib/brand-assets";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Slides · RAdev Social" };

// Every slide type of the brand with its saved identity: to see a whole brand at a glance.
export default async function BrandSlidesPage({ params }: PageProps<"/brands/[slug]/slides">) {
  const brand = await getBrandBySlug(db, (await params).slug);
  if (!brand) notFound();
  const parsed = parseTheme(brand.stylePreset, brand.themeTokens);
  const assets: SlideAssets = Object.fromEntries(
    (await listBrandAssets(db, brand.id)).map((a) => [
      a.id,
      { url: mediaUrl(a.path), width: a.width, height: a.height },
    ]),
  );

  return (
    <>
      <BrandTabs brand={brand} current="slides" />
      <section aria-labelledby="slides-heading" className="flex flex-col gap-6">
        <Plate as="h1" id="slides-heading" aside={brand.name}>
          Slides
        </Plate>
        {parsed.ok ? (
          <SlideGallery theme={parsed.theme} brandName={brand.name} assets={assets} />
        ) : (
          <p role="alert" className="border-l border-tally-red pl-3 text-sm text-ink">
            La identidad visual tiene errores ({parsed.issues.join("; ")}).{" "}
            <Link href={`/brands/${brand.slug}/identity`} className="underline underline-offset-2">
              Corregila en Identidad visual
            </Link>
            .
          </p>
        )}
      </section>
    </>
  );
}
