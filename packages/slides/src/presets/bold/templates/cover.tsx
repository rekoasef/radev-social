import type { SlideOf } from "../../../content/slides";
import { fitTextSize } from "../../shared/fit";
import { BOLD_CONTENT_BOX } from "../frame";
import { glowShadow, labelText, plainOf, Support, TITLE_GLYPHS, Title } from "../parts";

// `cover`: the hook. Kicker and a big title on top, subtitle at the bottom after a short accent
// line; lots of negative space in between. The frame adds the glow and "Deslizá →".

/** Cover titles run bigger than the rest, up to 4 lines at 850 (calibrated in T11). */
export function coverTitleSize(text: string): number {
  return fitTextSize(plainOf(text), {
    width: BOLD_CONTENT_BOX.width,
    sizes: [124, 104, 88, 76, 66],
    maxLines: 4,
    glyphs: TITLE_GLYPHS,
  });
}

export function CoverTemplate({ slide }: { slide: SlideOf<"cover"> }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        // The title may run to 4 lines: 850 keeps it clear of TikTok's buttons at any height.
        width: BOLD_CONTENT_BOX.width,
      }}
    >
      <div
        data-qa="content"
        style={{ paddingTop: 40, display: "flex", flexDirection: "column", gap: 36 }}
      >
        {slide.kicker && (
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <span
              style={{
                width: 3,
                height: 30,
                background: "var(--accent)",
                boxShadow: glowShadow(16),
              }}
            />
            <span data-qa="text" style={{ ...labelText(20), color: "var(--accent)" }}>
              {slide.kicker}
            </span>
          </div>
        )}
        <Title text={slide.title} size={coverTitleSize(slide.title)} />
      </div>
      {slide.subtitle && (
        <div
          data-qa="content"
          style={{ display: "flex", flexDirection: "column", gap: 28, paddingBottom: 20 }}
        >
          <span
            style={{
              width: 72,
              height: 4,
              borderRadius: 2,
              background: "var(--accent)",
              boxShadow: glowShadow(18),
            }}
          />
          <div style={{ maxWidth: 720 }}>
            <Support text={slide.subtitle} size={38} />
          </div>
        </div>
      )}
    </div>
  );
}
