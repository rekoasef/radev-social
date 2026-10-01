"use client";

import type { BrandTheme, Carousel, Datasets, SlideAssets } from "@radev/slides";
import { SlidePreview } from "@/components/brands/slide-preview";

/** Every slide of a carousel side by side, drawn in the browser as the render will draw them. */
export function PostStrip({
  carousel,
  theme,
  assets,
  brandName,
  seed,
  datasets,
  art,
}: {
  carousel: Carousel;
  theme: BrandTheme;
  assets: SlideAssets;
  brandName: string;
  /** The post id: without it, a post without a stored look would get a different one. */
  seed: string;
  /** The points frozen with the version (chart slides). */
  datasets?: Datasets;
  /** URLs of the version's generated images (ADR 0016). */
  art?: { cover?: string; cta?: string };
}) {
  return (
    <ol className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
      {carousel.slides.map((slide, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: slides have no identity besides their order
        <li key={index} className="min-w-0">
          <SlidePreview
            theme={theme}
            brandName={brandName}
            assets={assets}
            type={slide.type}
            content={slide}
            page={{ index, total: carousel.slides.length }}
            look={carousel.look}
            seed={seed}
            datasets={datasets}
            art={art}
          />
        </li>
      ))}
    </ol>
  );
}
