import { getBrandById, getPostById, getPostVersion } from "@radev/db";
import { carouselSchema, FORMAT, RenderSlide } from "@radev/slides";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { RenderReady } from "@/components/render/render-ready";
import { artUrls } from "@/lib/brand-assets";
import { brandRenderContext } from "@/lib/carousel";
import { db } from "@/lib/db";
import { isValidRenderToken, renderTokenFrom } from "@/lib/render-token";

// Internal page the worker renders (docs/ARCHITECTURE.md §8): one slide of a post version at its
// exact size, with the brand's identity and files, and nothing of the panel. No login: it
// requires RENDER_TOKEN in the X-Render-Token header (or ?token= by hand).
//   /render/<versionId>/<index>?format=4x5
// Decorations use the post id as seed, so every render of a post looks the same.
// window.__renderReady and window.__renderQa (components/render/render-ready.tsx) tell the
// worker when to take the screenshot and whether the slide passed the render QA.

export const metadata: Metadata = { robots: { index: false, follow: false } };

const paramsSchema = z.object({
  versionId: z.uuid(),
  index: z.coerce.number().int().min(0),
});

export default async function RenderSlidePage({
  params,
  searchParams,
}: PageProps<"/render/[versionId]/[index]">) {
  const [rawParams, query] = await Promise.all([params, searchParams]);
  if (!isValidRenderToken(await renderTokenFrom(query))) notFound();
  const parsed = paramsSchema.safeParse(rawParams);
  // Only 4:5 in v1 (ADR 0011).
  if (!parsed.success || (query.format !== undefined && query.format !== FORMAT.id)) notFound();

  const version = await getPostVersion(db, parsed.data.versionId);
  if (!version) notFound();
  const carousel = carouselSchema.safeParse(version.content);
  const slide = carousel.success ? carousel.data.slides[parsed.data.index] : undefined;
  if (!carousel.success || !slide) notFound();

  const post = await getPostById(db, version.postId);
  const brand = post ? await getBrandById(db, post.brandId) : undefined;
  if (!post || !brand) notFound();
  const render = await brandRenderContext(brand, post.id);
  if (!render.ok) notFound();

  const total = carousel.data.slides.length;
  // The version's generated images (ADR 0016), once art.generate is done with them.
  const art = artUrls(version.art?.images);
  return (
    <main
      data-render-root=""
      style={{
        position: "relative",
        width: FORMAT.width,
        height: FORMAT.height,
        overflow: "hidden",
      }}
    >
      {/* Charts draw the points frozen with the version (phase 3, T11); without them the
          template fails, so a chart never goes out with made-up numbers. */}
      <RenderSlide
        theme={render.theme}
        slide={slide}
        page={{ index: parsed.data.index, total }}
        seed={post.id}
        brandName={brand.name}
        assets={render.assets}
        datasets={version.datasets ?? {}}
        look={carousel.data.look}
        art={art}
      />
      <RenderReady />
      {/* Next's dev-tools badge would end up in the renders. */}
      <style>{"nextjs-portal{display:none!important}"}</style>
    </main>
  );
}
