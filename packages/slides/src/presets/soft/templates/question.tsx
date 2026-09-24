import type { SlideOf } from "../../../content/slides";
import { SOFT_CONTENT_BOX } from "../frame";
import { glassStyle, IconBadge, Rich, TemplateLayout } from "../parts";

// `question`: the question as title, and an elevated glass panel with the icon on the left and
// "lead + text" as one paragraph: lead in the text color, text in the secondary one.

export function QuestionTemplate({ slide }: { slide: SlideOf<"question"> }) {
  const { callout } = slide;
  return (
    <TemplateLayout title={slide.title} layout={slide.layout}>
      <div
        data-qa="content"
        style={{
          ...glassStyle(),
          background: "var(--elevated)",
          width: SOFT_CONTENT_BOX.width,
          display: "flex",
          alignItems: "center",
          gap: 32,
          padding: "40px 44px",
        }}
      >
        <IconBadge name={callout.icon} size={84} accent />
        <p
          data-qa="text"
          style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontWeight: "var(--weight-body)",
            fontSize: 33,
            lineHeight: 1.4,
            textWrap: "pretty",
            color: "var(--secondary)",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--text)" }}>
            <Rich text={callout.lead} />
          </span>{" "}
          <Rich text={callout.text} />
        </p>
      </div>
    </TemplateLayout>
  );
}
