import { getBrandBySlug, listBrandAssets } from "@radev/db";
import {
  exampleDatasets,
  exampleSlidesByPreset,
  extremeSlides,
  FORMAT,
  hasTemplate,
  isLookId,
  parseTheme,
  RenderSlide,
  SafeZoneOverlay,
  SLIDE_TYPES,
  type SlideAssets,
  SlideContent,
  SlideFrame,
} from "@radev/slides";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RenderReady } from "@/components/render/render-ready";
import { TikTokOverlay } from "@/components/render/tiktok-overlay";
import { mediaUrl } from "@/lib/brand-assets";
import { db } from "@/lib/db";
import { isValidRenderToken, renderTokenFrom } from "@/lib/render-token";

// Internal page: one slide of a brand at its exact size, with sample content, for previews and
// captures (pnpm capture). No login: it requires RENDER_TOKEN, in the X-Render-Token header
// (pnpm capture, the worker) or as ?token= when opened by hand.
//   /render/preview/<brand>/<slide>?token=…&page=3&total=7&seed=post-1&overlay=safe|tiktok
//     &variant=extreme (worst-case content, every text at its limit)
//     &qa=1 (outline and list the render QA issues)
//     &look=editorial (studio brands: the look to draw; by default one picked by the seed)
// <slide> is a slide type, or "frame" for the frame alone.

export const metadata: Metadata = { robots: { index: false, follow: false } };

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export default async function PreviewSlidePage({
  params,
  searchParams,
}: PageProps<"/render/preview/[brand]/[slide]">) {
  const [{ brand: slug, slide }, query] = await Promise.all([params, searchParams]);
  if (!isValidRenderToken(await renderTokenFrom(query))) notFound();
  const type = SLIDE_TYPES.find((t) => t === slide);
  if (slide !== "frame" && !type) notFound();

  const brand = await getBrandBySlug(db, slug);
  if (!brand) notFound();
  const parsed = parseTheme(brand.stylePreset, brand.themeTokens);
  if (!parsed.ok) {
    return (
      <pre style={{ padding: 24, color: "#f87171" }}>
        {`Tokens inválidos de ${brand.name}:\n${parsed.issues.join("\n")}`}
      </pre>
    );
  }

  const assets: SlideAssets = Object.fromEntries(
    (await listBrandAssets(db, brand.id)).map((a) => [
      a.id,
      { url: mediaUrl(a.path), width: a.width, height: a.height },
    ]),
  );
  const examples =
    single(query.variant) === "extreme"
      ? extremeSlides
      : exampleSlidesByPreset[parsed.theme.preset];
  const total = positiveInt(single(query.total), 7);
  const pageNumber = Math.min(positiveInt(single(query.page), 1), total);
  const overlay = single(query.overlay);
  const look = single(query.look);
  const seed = single(query.seed) ?? "preview";

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
      {parsed.theme.preset === "studio" ? (
        // Studio draws frame and content together: "frame" shows the cover.
        <RenderSlide
          theme={parsed.theme}
          slide={examples[type ?? "cover"]}
          page={{ index: pageNumber - 1, total }}
          seed={seed}
          brandName={brand.name}
          assets={assets}
          datasets={exampleDatasets}
          look={look && isLookId(look) ? look : undefined}
        />
      ) : (
        <SlideFrame
          theme={parsed.theme}
          brandName={brand.name}
          page={{ index: pageNumber - 1, total }}
          seed={seed}
          glow={slide === "cover" || slide === "cta"}
          assets={assets}
        >
          {type &&
            (hasTemplate(parsed.theme.preset, type) ? (
              <SlideContent
                theme={parsed.theme}
                slide={examples[type]}
                datasets={exampleDatasets}
                assets={assets}
              />
            ) : (
              <p style={{ margin: "auto", fontSize: 28, opacity: 0.5 }}>
                Plantilla {type}: pendiente
              </p>
            ))}
        </SlideFrame>
      )}
      {overlay === "safe" && <SafeZoneOverlay />}
      {overlay === "tiktok" && <TikTokOverlay />}
      <RenderReady showQa={single(query.qa) === "1"} />
      {/* Next's dev-tools badge would end up in the captures. */}
      <style>{"nextjs-portal{display:none!important}"}</style>
    </main>
  );
}
