import type { SlideOf } from "../../../content/slides";
import { BOLD_CONTENT_BOX } from "../frame";
import { boxStyle, glowShadow, labelText, Support, TemplateLayout } from "../parts";

// `costBreakdown`: one row per item (label left, range right) between thin dividers, then the
// total in a highlighted box. Ranges come only from the brand's pricing document.

const rangeStyle = {
  fontFamily: "var(--font-label)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
} as const;

export function CostBreakdownTemplate({ slide }: { slide: SlideOf<"costBreakdown"> }) {
  // Five or six rows get a smaller size, so each row keeps to one line with wide fonts too.
  const rowSize = slide.items.length >= 5 ? 26 : 30;
  return (
    <TemplateLayout title={slide.title} layout={slide.layout}>
      <div
        style={{ width: BOLD_CONTENT_BOX.width, display: "flex", flexDirection: "column", gap: 28 }}
      >
        <div data-qa="content" style={{ display: "flex", flexDirection: "column" }}>
          {slide.items.map((item, i) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 24,
                // Five or six rows: tighter, so rows that wrap (wide fonts) still leave room
                // for the total and the note.
                padding: slide.items.length >= 5 ? "13px 4px" : "20px 4px",
                borderTop: i === 0 ? "none" : "1px solid var(--line)",
              }}
            >
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 400,
                  fontSize: rowSize,
                  color: "var(--text)",
                }}
              >
                {item.label}
              </span>
              <span
                data-qa="text"
                style={{ ...rangeStyle, fontSize: rowSize, color: "var(--text)" }}
              >
                {item.range}
              </span>
            </div>
          ))}
        </div>
        <div
          data-qa="content"
          style={{
            ...boxStyle("var(--radius-callout)"),
            boxShadow: glowShadow(30),
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            padding: "30px 36px",
          }}
        >
          <span data-qa="text" style={{ ...labelText(20), color: "var(--text)" }}>
            {slide.total.label}
          </span>
          <span data-qa="text" style={{ ...rangeStyle, fontSize: 44, color: "var(--accent)" }}>
            {slide.total.range}
          </span>
        </div>
      </div>
      {slide.note && <Support text={slide.note} size={24} />}
    </TemplateLayout>
  );
}
