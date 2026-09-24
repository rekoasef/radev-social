import type { SlideOf } from "../../../content/slides";
import { FORMAT } from "../../../frame/geometry";
import { resolveAsset, type SlideAssets } from "../../../frame/types";
import { SlideIcon } from "../../../icons";
import { SOFT_CONTENT_BOX } from "../frame";
import { Hero, Support, Title } from "../parts";
import type { SoftTokens } from "../tokens";

// `cta`: the closing, centered on the slide. The hero element on top, title and subtitle, and a
// pill button (text color background, bg color text). The site is already in the footer.

/** Centered on the slide, and still left of TikTok's button column (x < 930). */
const COLUMN_WIDTH = 760;
const COLUMN_LEFT = (FORMAT.width - COLUMN_WIDTH) / 2 - SOFT_CONTENT_BOX.x;

export function CtaTemplate({
  slide,
  tokens,
  assets,
}: {
  slide: SlideOf<"cta">;
  tokens: SoftTokens;
  assets: SlideAssets;
}) {
  const hero = resolveAsset(assets, tokens.heroAsset);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 44,
        height: "100%",
        width: COLUMN_WIDTH,
        marginLeft: COLUMN_LEFT,
        paddingBottom: 30,
      }}
    >
      {hero && <Hero asset={hero} size={260} />}
      <div
        data-qa="content"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}
      >
        <Title text={slide.title} align="center" />
        {slide.subtitle && <Support text={slide.subtitle} size={34} align="center" />}
      </div>
      <div
        data-qa="content"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 16,
          maxWidth: COLUMN_WIDTH,
          boxSizing: "border-box",
          padding: "26px 48px",
          borderRadius: 999,
          background: "var(--text)",
          color: "var(--bg)",
          boxShadow: "0 0 32px color-mix(in srgb, var(--accent) 28%, transparent)",
        }}
      >
        {slide.icon && (
          <span style={{ display: "inline-flex", flexShrink: 0 }}>
            <SlideIcon name={slide.icon} size={34} strokeWidth={2} />
          </span>
        )}
        <span
          data-qa="text"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: 32,
            lineHeight: 1.15,
            textWrap: "balance",
            textAlign: "center",
          }}
        >
          {slide.button}
        </span>
      </div>
    </div>
  );
}
