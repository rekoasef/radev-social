import type { SlideOf } from "../../../content/slides";
import { SOFT_CONTENT_BOX } from "../frame";
import { glassStyle, IconBadge, Rich, Support, TemplateLayout } from "../parts";

// `comparison`: two glass columns. The right one is the option the verdict leans to: accent
// tinted border and markers; the left one stays neutral.

type Side = SlideOf<"comparison">["left"];

const GAP = 20;

function Column({ side, favored }: { side: Side; favored: boolean }) {
  return (
    <div
      data-qa="content"
      style={{
        ...glassStyle("var(--radius-panel)"),
        ...(favored
          ? {
              border: "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
              boxShadow: "0 0 40px color-mix(in srgb, var(--accent) 12%, transparent)",
            }
          : {}),
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 28,
        padding: "32px 30px 34px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {side.icon && <IconBadge name={side.icon} size={60} accent={favored} />}
        <span
          data-qa="text"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: "var(--weight-display)",
            fontSize: 32,
            lineHeight: 1.25,
            color: "var(--text)",
          }}
        >
          {side.name}
        </span>
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {side.points.map((point) => (
          <li
            key={point}
            data-qa="text"
            style={{
              display: "flex",
              gap: 14,
              fontFamily: "var(--font-body)",
              fontWeight: "var(--weight-body)",
              fontSize: 26,
              lineHeight: 1.35,
              color: "var(--secondary)",
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 7,
                height: 7,
                marginTop: 14,
                borderRadius: "50%",
                background: favored ? "var(--accent)" : "var(--muted)",
              }}
            />
            <span>
              <Rich text={point} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComparisonTemplate({ slide }: { slide: SlideOf<"comparison"> }) {
  return (
    <TemplateLayout title={slide.title}>
      <div
        style={{ display: "flex", alignItems: "stretch", gap: GAP, width: SOFT_CONTENT_BOX.width }}
      >
        <Column side={slide.left} favored={false} />
        <Column side={slide.right} favored />
      </div>
      <Support text={slide.verdict} size={31} />
    </TemplateLayout>
  );
}
