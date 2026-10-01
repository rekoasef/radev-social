import { ideaPrompt } from "@radev/core";
import { getIdea, listPillars } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { CarouselEditor } from "@/components/posts/carousel-editor";
import { GenerateForm } from "@/components/posts/generate-form";
import { getBrandContext } from "@/lib/active-brand";
import { blankCarousel, brandRenderContext, editorData } from "@/lib/carousel";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Nuevo post · RAdev Social" };

// A new carousel for the brand the panel is tuned to. `?idea=<id>` comes from the idea bank:
// "Generar con IA" opens filled in with it (only a new idea of this brand).
export default async function NewPostPage({ searchParams }: PageProps<"/posts/new">) {
  const [{ activeBrand: brand }, query] = await Promise.all([getBrandContext(), searchParams]);
  if (!brand) {
    return (
      <section>
        <Plate as="h1">Nuevo post</Plate>
        <p className="mt-6 text-sm text-ink-dim">No hay marcas activas.</p>
      </section>
    );
  }
  const ideaId = typeof query.idea === "string" ? query.idea : undefined;
  const [render, pillars, bankIdea, data] = await Promise.all([
    brandRenderContext(brand),
    listPillars(db, brand.id),
    ideaId && /^[0-9a-f-]{36}$/i.test(ideaId) ? getIdea(db, ideaId) : undefined,
    editorData(brand.id),
  ]);
  const fromIdea =
    bankIdea && bankIdea.brandId === brand.id && bankIdea.status === "new"
      ? {
          id: bankIdea.id,
          text: ideaPrompt(bankIdea),
          // Only a pillar that can still take posts.
          pillarKey: pillars.some((p) => p.key === bankIdea.pillarKey) ? bankIdea.pillarKey : null,
        }
      : undefined;

  return (
    <section aria-labelledby="new-post-heading" className="flex flex-col gap-6">
      <Link
        href={ideaId ? "/ideas" : "/posts"}
        className="plate-text w-fit text-ink-faint hover:text-ink"
      >
        {ideaId ? "← Ideas" : "← Posts"}
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
        <>
          <section aria-labelledby="generate-heading" className="flex flex-col gap-5">
            <Plate id="generate-heading" aside="IA">
              Generar con IA
            </Plate>
            {ideaId && !fromIdea && (
              <p role="alert" className="border-l border-tally-amber pl-3 text-sm text-ink">
                Esa idea ya se usó, se descartó o es de otra marca.
              </p>
            )}
            <GenerateForm
              brand={{ id: brand.id, name: brand.name }}
              pillars={pillars.map((p) => ({ key: p.key, name: p.name }))}
              fromIdea={fromIdea}
            />
          </section>
          <section aria-labelledby="manual-heading" className="flex flex-col gap-5">
            <Plate id="manual-heading" aside="Editor">
              Armar a mano
            </Plate>
            <CarouselEditor
              brand={{ id: brand.id, slug: brand.slug, name: brand.name }}
              theme={render.theme}
              assets={render.assets}
              pillars={pillars.map((p) => ({ key: p.key, name: p.name }))}
              initial={blankCarousel(pillars[0]?.key ?? "")}
              data={data}
            />
          </section>
        </>
      )}
    </section>
  );
}
