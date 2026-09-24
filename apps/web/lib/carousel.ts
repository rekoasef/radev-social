import type { Brand } from "@radev/db";
import { listBrandAssets } from "@radev/db";
import {
  type BrandTheme,
  type Carousel,
  emptySlide,
  parseTheme,
  type SlideAssets,
} from "@radev/slides";
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
