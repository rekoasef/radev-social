import type { Datasets } from "./content/datasets";
import type { Slide } from "./content/slides";
import { SlideFrame } from "./frame/slide-frame";
import type { SlideAssets } from "./frame/types";
import type { BrandTheme } from "./presets/registry";
import { StudioSlide } from "./presets/studio/frame";
import type { LookId } from "./presets/studio/look-ids";
import { resolveLook } from "./presets/studio/looks";
import { enabledLooks } from "./presets/studio/tokens";
import { SlideContent } from "./slide-content";

// One slide at its render size (1080×1350), whatever the brand's preset: the frame and the
// template, or the look of the post for `studio`. The render page, the previews and the editor
// all draw slides through here.

export type RenderSlideProps = {
  theme: BrandTheme;
  slide: Slide;
  page: { index: number; total: number };
  /** Seed for deterministic variation: the post id. */
  seed: string;
  brandName: string;
  assets?: SlideAssets;
  datasets?: Datasets;
  /** The post's look (`studio`); without it, one of the brand's looks picked by the seed. */
  look?: LookId;
};

export function RenderSlide({
  theme,
  slide,
  page,
  seed,
  brandName,
  assets = {},
  datasets = {},
  look,
}: RenderSlideProps) {
  if (theme.preset === "studio") {
    return (
      <StudioSlide
        tokens={theme.tokens}
        look={resolveLook(look, enabledLooks(theme.tokens), seed)}
        slide={slide}
        page={page}
        seed={seed}
        brandName={brandName}
        assets={assets}
        datasets={datasets}
      />
    );
  }
  return (
    <SlideFrame
      theme={theme}
      brandName={brandName}
      page={page}
      seed={seed}
      glow={slide.type === "cover" || slide.type === "cta"}
      assets={assets}
    >
      <SlideContent theme={theme} slide={slide} datasets={datasets} assets={assets} />
    </SlideFrame>
  );
}
