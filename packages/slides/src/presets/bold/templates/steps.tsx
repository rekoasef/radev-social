import type { SlideOf } from "../../../content/slides";
import { BOLD_CONTENT_BOX } from "../frame";
import { glowShadow, Rich, supportEmphasis, TemplateLayout } from "../parts";

// `steps`: numbered steps down a vertical rail. Each number sits in an accent-bordered square;
// the rail joins them. Title of the step in bold, text below in the support style.

const BADGE = 64;

export function StepsTemplate({ slide }: { slide: SlideOf<"steps"> }) {
  const count = slide.steps.length;
  const gap = count >= 5 ? 26 : 36;
  return (
    <TemplateLayout title={slide.title} layout={slide.layout}>
      <ol
        style={{
          position: "relative",
          width: BOLD_CONTENT_BOX.width,
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap,
        }}
      >
        {slide.steps.map((step, i) => (
          <li
            key={step.title}
            data-qa="content"
            style={{ position: "relative", display: "flex", gap: 30 }}
          >
            {/* Rail from this badge down to the next one (the step's height plus the gap). */}
            {i < count - 1 && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: BADGE / 2 - 1,
                  top: BADGE,
                  height: `calc(100% - ${BADGE}px + ${gap}px)`,
                  width: 2,
                  background: "var(--accent)",
                  opacity: 0.55,
                }}
              />
            )}
            <span
              style={{
                flexShrink: 0,
                width: BADGE,
                height: BADGE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
                borderRadius: 14,
                border: "1.5px solid var(--accent)",
                background: "var(--surface)",
                boxShadow: glowShadow(20),
                fontFamily: "var(--font-display)",
                fontWeight: "var(--weight-display)",
                fontSize: 28,
                color: "var(--accent)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 10 }}>
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 700,
                  fontSize: 32,
                  lineHeight: 1.15,
                  color: "var(--text)",
                }}
              >
                <Rich text={step.title} emphasis={{ color: "var(--accent)" }} />
              </span>
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--weight-body)",
                  fontSize: 27,
                  lineHeight: 1.3,
                  color: "color-mix(in srgb, var(--text) 82%, var(--bg))",
                  textWrap: "pretty",
                }}
              >
                <Rich text={step.text} emphasis={supportEmphasis} />
              </span>
            </div>
          </li>
        ))}
      </ol>
    </TemplateLayout>
  );
}
