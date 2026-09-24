import { listPillars } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { CarouselEditor } from "@/components/posts/carousel-editor";
import { getBrandContext } from "@/lib/active-brand";
import { blankCarousel, brandRenderContext } from "@/lib/carousel";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Nuevo post · RAdev Social" };

// A new carousel for the brand the panel is tuned to.
export default async function NewPostPage() {
  const { activeBrand: brand } = await getBrandContext();
  if (!brand) {
    return (
      <section>
        <Plate as="h1">Nuevo post</Plate>
        <p className="mt-6 text-sm text-ink-dim">No hay marcas activas.</p>
      </section>
    );
  }
  const [render, pillars] = await Promise.all([
    brandRenderContext(brand),
    listPillars(db, brand.id),
  ]);

  return (
    <section aria-labelledby="new-post-heading" className="flex flex-col gap-6">
      <Link href="/posts" className="plate-text w-fit text-ink-faint hover:text-ink">
        ← Posts
      </Link>
      <Plate as="h1" id="new-post-heading" aside={brand.name}>
        Nuevo post
      </Plate>
      {!render.ok ? (
        <p role="alert" className="text-sm text-ink">
          La identidad visual de {brand.name} tiene errores: corregila antes de armar posts.
        </p>
      ) : pillars.length === 0 ? (
        <p role="alert" className="text-sm text-ink">
          {brand.name} no tiene pilares de contenido todavía.
        </p>
      ) : (
        <CarouselEditor
          brand={{ id: brand.id, slug: brand.slug, name: brand.name }}
          theme={render.theme}
          assets={render.assets}
          pillars={pillars.map((p) => ({ key: p.key, name: p.name }))}
          initial={blankCarousel(pillars[0]?.key ?? "")}
        />
      )}
    </section>
  );
}
