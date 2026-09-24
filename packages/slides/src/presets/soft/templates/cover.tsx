import { parseEmphasis } from "../../../content/emphasis";
import type { SlideOf } from "../../../content/slides";
import { resolveAsset, type SlideAssets } from "../../../frame/types";
import { SOFT_CONTENT_BOX } from "../frame";
import { Hero, labelText, Support, Title } from "../parts";
import type { SoftTokens } from "../tokens";

// `cover`: the hook. Kicker and title on top, the brand's hero element in the middle, the
// subtitle at the bottom. Without a hero asset, the middle stays as negative space.

/** Cover titles run bigger than the rest (calibrated in T11). */
export function coverTitleSize(text: string): number {
  const parsed = parseEmphasis(text);
  const length = [...(parsed.ok ? parsed.plain : text)].length;
  if (length <= 20) return 108;
  if (length <= 40) return 92;
  return 80;
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
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Centered on the slide, not on the content box (which stops at x = 930).
          transform: `translateX(${(1080 - 2 * SOFT_CONTENT_BOX.x - SOFT_CONTENT_BOX.width) / 2}px)`,
        }}
      >
        {hero && <Hero asset={hero} size={HERO_SIZE} />}
      </div>
      {slide.subtitle && (
        <div data-qa="content" style={{ paddingBottom: 20, maxWidth: 720 }}>
          <Support text={slide.subtitle} size={36} />
        </div>
      )}
    </div>
  );
}
