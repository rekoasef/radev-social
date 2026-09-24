import type { SlideOf } from "../../../content/slides";
import { Layer } from "../../../frame/layer";
import { resolveAsset, type SlideAssets } from "../../../frame/types";
import { fitTextSize } from "../../shared/fit";
import { SOFT_CONTENT_BOX } from "../frame";
import { Hero, labelText, plainOf, Support, TITLE_GLYPHS, Title } from "../parts";
import type { SoftTokens } from "../tokens";

// `cover`: the hook. Kicker and title on top, the brand's hero element in the middle, the
// subtitle at the bottom. Without a hero asset, the middle stays as negative space.

/** Cover titles run bigger than the rest, up to 4 lines at 850 (calibrated in T11). */
export function coverTitleSize(text: string): number {
  return fitTextSize(plainOf(text), {
    width: SOFT_CONTENT_BOX.width,
    sizes: [108, 92, 80, 70, 62],
    maxLines: 4,
    glyphs: TITLE_GLYPHS,
  });
}

const HERO_SIZE = 400;

export function CoverTemplate({
  slide,
  tokens,
  assets,
}: {
  slide: SlideOf<"cover">;
  tokens: SoftTokens;
  assets: SlideAssets;
}) {
  const hero = resolveAsset(assets, tokens.heroAsset);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: SOFT_CONTENT_BOX.width,
      }}
    >
      <Layer name="title" layout={slide.layout}>
        <div
          data-qa="content"
          style={{ paddingTop: 40, display: "flex", flexDirection: "column", gap: 28 }}
        >
          {slide.kicker && (
            <span data-qa="text" style={{ ...labelText(20), color: "var(--accent)" }}>
              {slide.kicker}
            </span>
          )}
          <Title text={slide.title} size={coverTitleSize(slide.title)} />
        </div>
      </Layer>
      <Layer
        name="hero"
        layout={slide.layout}
        // Centered on the slide, not on the content box (which stops at x = 930).
        baseTransform={`translateX(${(1080 - 2 * SOFT_CONTENT_BOX.x - SOFT_CONTENT_BOX.width) / 2}px)`}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 0",
        }}
      >
        {hero && <Hero asset={hero} size={HERO_SIZE} />}
      </Layer>
      {slide.subtitle && (
        <Layer name="body" layout={slide.layout}>
          <div data-qa="content" style={{ paddingBottom: 20, maxWidth: 720 }}>
            <Support text={slide.subtitle} size={36} />
          </div>
        </Layer>
      )}
    </div>
  );
}
