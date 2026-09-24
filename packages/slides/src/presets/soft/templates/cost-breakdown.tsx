import type { SlideOf } from "../../../content/slides";
import { SOFT_CONTENT_BOX } from "../frame";
import { glassStyle, labelText, numericText, Support, TemplateLayout } from "../parts";

// `costBreakdown`: one row per item (label left, range right in the numeric font) between thin
// dividers, then the total in an elevated panel with the range in accent. Ranges come only from
// the brand's pricing document.

export function CostBreakdownTemplate({ slide }: { slide: SlideOf<"costBreakdown"> }) {
  return (
    <TemplateLayout title={slide.title}>
      <div
        style={{ width: SOFT_CONTENT_BOX.width, display: "flex", flexDirection: "column", gap: 28 }}
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
                padding: "20px 4px",
                borderTop: i === 0 ? "none" : "1px solid var(--line)",
              }}
            >
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--weight-body)",
                  fontSize: 29,
                  color: "var(--secondary)",
                }}
              >
                {item.label}
              </span>
              <span data-qa="text" style={{ ...numericText, fontSize: 28, color: "var(--text)" }}>
                {item.range}
              </span>
            </div>
          ))}
        </div>
        <div
          data-qa="content"
          style={{
            ...glassStyle(),
            background: "var(--elevated)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            padding: "30px 36px",
          }}
        >
          <span data-qa="text" style={{ ...labelText(19), color: "var(--secondary)" }}>
            {slide.total.label}
          </span>
          <span data-qa="text" style={{ ...numericText, fontSize: 42, color: "var(--accent)" }}>
            {slide.total.range}
          </span>
        </div>
      </div>
      {slide.note && <Support text={slide.note} size={23} />}
    </TemplateLayout>
  );
}
