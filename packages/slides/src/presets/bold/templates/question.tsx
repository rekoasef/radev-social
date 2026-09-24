import type { SlideOf } from "../../../content/slides";
import { BOLD_CONTENT_BOX } from "../frame";
import { boxStyle, glowShadow, IconTile, Rich, supportEmphasis, TemplateLayout } from "../parts";

// `question`: the question as title, and a callout box (radius `callout`) with the icon on the
// left and "lead + text" as one paragraph: lead in bold, text in the support style.

export function QuestionTemplate({ slide }: { slide: SlideOf<"question"> }) {
  const { callout } = slide;
  return (
    <TemplateLayout title={slide.title} layout={slide.layout}>
      <div
        data-qa="content"
        style={{
          ...boxStyle("var(--radius-callout)"),
          boxShadow: glowShadow(30),
          width: BOLD_CONTENT_BOX.width,
          display: "flex",
          alignItems: "center",
          gap: 34,
          padding: "40px 44px",
        }}
      >
        <IconTile name={callout.icon} size={88} accent />
        <p
          data-qa="text"
          style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontWeight: "var(--weight-body)",
            fontSize: 34,
            lineHeight: 1.3,
            textWrap: "pretty",
            color: "color-mix(in srgb, var(--text) 82%, var(--bg))",
          }}
        >
          <strong style={{ fontWeight: 700, color: "var(--text)" }}>
            <Rich text={callout.lead} emphasis={{ color: "var(--accent)" }} />
          </strong>{" "}
          <Rich text={callout.text} emphasis={supportEmphasis} />
        </p>
      </div>
    </TemplateLayout>
  );
}
