import type { SlideOf } from "../../../content/slides";
import { SOFT_CONTENT_BOX } from "../frame";
import { numericText, Rich, TemplateLayout } from "../parts";

// `steps`: numbered steps down a thin rail. Each number sits in a round badge with an accent
// tint; step title in the text color, text below in the secondary one.

const BADGE = 60;

export function StepsTemplate({ slide }: { slide: SlideOf<"steps"> }) {
  const count = slide.steps.length;
  const gap = count >= 5 ? 26 : 36;
  return (
    <TemplateLayout title={slide.title}>
      <ol
        style={{
          position: "relative",
          width: SOFT_CONTENT_BOX.width,
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
            {i < count - 1 && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: BADGE / 2 - 0.5,
                  top: BADGE + 8,
                  height: `calc(100% - ${BADGE + 16}px + ${gap}px)`,
                  width: 1,
                  background: "var(--line)",
                }}
              />
            )}
            <span
              style={{
                ...numericText,
                flexShrink: 0,
                width: BADGE,
                height: BADGE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "color-mix(in srgb, var(--accent) 14%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
                boxSizing: "border-box",
                fontSize: 22,
                color: "var(--accent)",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 10 }}>
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: "var(--weight-display)",
                  fontSize: 32,
                  lineHeight: 1.2,
                  // Hanken Grotesk's descenders reach below a 1.2 line box.
                  paddingBottom: "0.08em",
                  color: "var(--text)",
                }}
              >
                <Rich text={step.title} />
              </span>
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--weight-body)",
                  fontSize: 26,
                  lineHeight: 1.4,
                  color: "var(--secondary)",
                  textWrap: "pretty",
                }}
              >
                <Rich text={step.text} />
              </span>
            </div>
          </li>
        ))}
      </ol>
    </TemplateLayout>
  );
}
