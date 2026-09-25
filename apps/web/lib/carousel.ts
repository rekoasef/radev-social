import type { DataSeries } from "@radev/core";
import type { Brand } from "@radev/db";
import { getBrandData, listBrandAssets } from "@radev/db";
import {
  type BrandTheme,
  type Carousel,
  emptySlide,
  parseTheme,
  type SlideAssets,
} from "@radev/slides";
import type { EditorData } from "@/components/posts/carousel-editor";
import { mediaUrl } from "./brand-assets";
import { db } from "./db";

/** A carousel to start from: cover, three slides and the closing, with empty texts. */
export function blankCarousel(pillarKey: string): Carousel {
  return {
    hook: "",
    pillarKey,
    hookType: "howto",
    slides: [
      emptySlide("cover"),
      emptySlide("statement"),
      emptySlide("cardGrid"),
      emptySlide("steps"),
      emptySlide("cta"),
    ],
    caption: "",
    hashtags: [],
  };
}

/** What a brand needs to draw its slides: the parsed identity and its files by id. */
export async function brandRenderContext(
  brand: Brand,
): Promise<{ ok: true; theme: BrandTheme; assets: SlideAssets } | { ok: false; issues: string[] }> {
  const parsed = parseTheme(brand.stylePreset, brand.themeTokens);
  if (!parsed.ok) return parsed;
  const assets: SlideAssets = Object.fromEntries(
    (await listBrandAssets(db, brand.id)).map((a) => [
      a.id,
      { url: mediaUrl(a.path), width: a.width, height: a.height },
    ]),
  );
  return { ok: true, theme: parsed.theme, assets };
}

/**
 * The brand's data for the editor: today's datasets and figures, plus the datasets frozen with
 * the version being edited (they win: that chart keeps its points). Null with neither.
 */
export async function editorData(
  brandId: string,
  frozen: Record<string, DataSeries> | null = null,
): Promise<EditorData | null> {
  const today = await getBrandData(db, brandId);
  const datasets = { ...today?.datasets, ...frozen };
  const keys = Object.keys(datasets);
  if (!today && keys.length === 0) return null;
  return {
    datasets,
    options: keys.map((key) => ({
      key,
      title: frozen?.[key]
        ? `${datasets[key]?.title} (el de esta versión)`
        : (datasets[key]?.title ?? key),
    })),
    figures: today?.figures ?? [],
  };
}
