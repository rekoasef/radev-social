import type { SlideOf } from "../../../content/slides";
import { Layer } from "../../../frame/layer";
import { SOFT_CONTENT_BOX } from "../frame";
import { labelText, Rich, Source, Support } from "../parts";

// `bigNumber`: one huge figure in accent, with its label, some context and the source. The figure
// uses the display font with tabular digits, not the numeric one: at this size a monospaced
// font's slashed zero takes over the slide. The size follows the length so it fits the 850 width
// on one line. The value comes from the brand's data, never from the AI.

/** Width of a tabular digit of the display font, in em (with some margin for wider fonts). */
const DIGIT_EM = 0.6;

export function bigNumberSize(value: string): number {
  const fits = SOFT_CONTENT_BOX.width / ([...value].length * DIGIT_EM);
  return Math.floor(Math.min(220, fits));
}

export function BigNumberTemplate({ slide }: { slide: SlideOf<"bigNumber"> }) {
  return (
    <div
      style={{
        height: "100%",
        width: SOFT_CONTENT_BOX.width,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 40,
      }}
    >
      {/* The figure is this slide's title layer; context and source move as the body. */}
      <Layer name="title" layout={slide.layout}>
        <div data-qa="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {slide.kicker && (
            <span data-qa="text" style={{ ...labelText(20), color: "var(--accent)" }}>
              <Rich text={slide.kicker} />
            </span>
          )}
          <span
            data-qa="text"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: "var(--weight-display)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              fontSize: bigNumberSize(slide.value),
              lineHeight: 1.15,
              // The digits' ink runs past the line box: room so the overflow check stays meaningful.
              paddingBottom: "0.08em",
              letterSpacing: "-0.03em",
              color: "var(--accent)",
              textShadow: "0 0 48px color-mix(in srgb, var(--accent) 25%, transparent)",
            }}
          >
            {slide.value}
          </span>
          <p
            data-qa="text"
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: "var(--weight-display)",
              fontSize: 42,
              lineHeight: 1.2,
              paddingBottom: "0.08em",
              color: "var(--text)",
              textWrap: "balance",
            }}
          >
            <Rich text={slide.label} />
          </p>
        </div>
      </Layer>
      <Layer
        name="body"
        layout={slide.layout}
        style={{ display: "flex", flexDirection: "column", gap: 40 }}
      >
        {slide.context && (
          <div style={{ maxWidth: 760 }}>
            <Support text={slide.context} size={30} />
          </div>
        )}
        <Source text={slide.source} />
      </Layer>
    </div>
  );
}
