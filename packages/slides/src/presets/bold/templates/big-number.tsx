import type { SlideOf } from "../../../content/slides";
import { BOLD_CONTENT_BOX } from "../frame";
import { labelText, Rich, Source, Support, supportEmphasis } from "../parts";

// `bigNumber`: one huge figure in accent with its label, some context and the source. The
// figure's size follows its length so it always fits the 850 width on one line. The value comes
// from the brand's data, never from the AI.

/** Width of a display glyph (Inter Tight 900, digits and signs), in em. */
const DIGIT_EM = 0.6;

export function bigNumberSize(value: string): number {
  const fits = BOLD_CONTENT_BOX.width / ([...value].length * DIGIT_EM);
  return Math.floor(Math.min(260, fits));
}

export function BigNumberTemplate({ slide }: { slide: SlideOf<"bigNumber"> }) {
  return (
    <div
      style={{
        height: "100%",
        width: BOLD_CONTENT_BOX.width,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 40,
      }}
    >
      <div data-qa="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {slide.kicker && (
          <span data-qa="text" style={{ ...labelText(20), color: "var(--accent)" }}>
            <Rich text={slide.kicker} emphasis={{ color: "var(--text)" }} />
          </span>
        )}
        <span
          data-qa="text"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: "var(--weight-display)",
            fontSize: bigNumberSize(slide.value),
            lineHeight: 1.12,
            // The digits' ink runs ~0.05em past the line box (see Title in parts.tsx).
            paddingBottom: "0.06em",
            letterSpacing: "-0.03em",
            whiteSpace: "nowrap",
            color: "var(--accent)",
            fontVariantNumeric: "tabular-nums",
            textShadow:
              "0 0 calc(var(--glow) * 60px) color-mix(in srgb, var(--accent) 40%, transparent)",
          }}
        >
          {slide.value}
        </span>
        <p
          data-qa="text"
          style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: 42,
            lineHeight: 1.2,
            color: "var(--text)",
            textWrap: "balance",
          }}
        >
          <Rich text={slide.label} emphasis={supportEmphasis} />
        </p>
      </div>
      {slide.context && (
        <div style={{ maxWidth: 760 }}>
          <Support text={slide.context} size={30} />
        </div>
      )}
      <Source text={slide.source} />
    </div>
  );
}
