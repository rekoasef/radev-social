import { getBrandBySlug } from "@radev/db";
import {
  exampleSlides,
  FORMAT,
  hasTemplate,
  parseTheme,
  SafeZoneOverlay,
  SLIDE_TYPES,
  SlideContent,
  SlideFrame,
} from "@radev/slides";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RenderReady } from "@/components/render/render-ready";
import { TikTokOverlay } from "@/components/render/tiktok-overlay";
import { db } from "@/lib/db";
import { isValidRenderToken } from "@/lib/render-token";

// Internal page: one slide of a brand at its exact size, with sample content, for previews and
// captures (pnpm capture). No login: it requires ?token=RENDER_TOKEN.
//   /render/preview/<brand>/<slide>?token=…&page=3&total=7&seed=post-1&overlay=safe|tiktok
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
  if (!isValidRenderToken(query.token)) notFound();
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

  const total = positiveInt(single(query.total), 7);
  const pageNumber = Math.min(positiveInt(single(query.page), 1), total);
  const overlay = single(query.overlay);

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
      <SlideFrame
        theme={parsed.theme}
        brandName={brand.name}
        page={{ index: pageNumber - 1, total }}
        seed={single(query.seed) ?? "preview"}
        glow={slide === "cover" || slide === "cta"}
      >
        {type &&
          (hasTemplate(parsed.theme.preset, type) ? (
            <SlideContent theme={parsed.theme} slide={exampleSlides[type]} />
          ) : (
            <p style={{ margin: "auto", fontSize: 28, opacity: 0.5 }}>
              Plantilla {type}: pendiente
            </p>
          ))}
      </SlideFrame>
      {overlay === "safe" && <SafeZoneOverlay />}
      {overlay === "tiktok" && <TikTokOverlay />}
      <RenderReady />
      {/* Next's dev-tools badge would end up in the captures. */}
      <style>{"nextjs-portal{display:none!important}"}</style>
    </main>
  );
}
