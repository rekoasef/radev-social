"use client";

import type { BrandTheme, Carousel, SlideAssets } from "@radev/slides";
import { SlidePreview } from "@/components/brands/slide-preview";

/** Every slide of a carousel side by side, drawn in the browser. */
export function PostStrip({
  carousel,
  theme,
  assets,
  brandName,
}: {
  carousel: Carousel;
  theme: BrandTheme;
  assets: SlideAssets;
  brandName: string;
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
          />
        </li>
      ))}
    </ol>
  );
}
